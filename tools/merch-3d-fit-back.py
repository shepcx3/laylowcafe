# Higher-quality 3D files for merch items that have a real back photo. Run it after tools/merch-3d.py.
#
#   python3 tools/merch-3d-fit-back.py SRC_DIR assets/img/merch assets/img/merch
#
# SRC_DIR holds the cut-out NAME-back.webp photos (900x1000, transparent background). For each item in
# ITEMS (name: how strongly to paint out the front print when making plain fabric) it warps the back
# photo onto the front's mirrored outline: the middle keeps its true shape so the print isn't bent, and
# only the outer edge bends to meet the outline. It also writes a finer 16-bit depth map (red = high
# byte, green = low byte) with gently rounded edges. Needs: pip install numpy opencv-python-headless pillow
import sys, numpy as np, cv2
from PIL import Image
OUT, PREV, DST = sys.argv[1], sys.argv[2], sys.argv[3]   # out/: fitted photos; PREV: current site files
ITEMS={'hoodie':36,'tee-sage':30,'tee-grey':30}
def rgba(p): return np.array(Image.open(p).convert('RGBA'))
def smooth_extent(v, ok, sigma=12):
    idx=np.arange(len(v)); v=np.interp(idx, idx[ok], v[ok]) if ok.any() else v.astype(float)
    return cv2.GaussianBlur(v.reshape(1,-1).astype(np.float32),(0,0),sigma).ravel()
def extents(al, axis):
    m=al>128; n=m.shape[1-axis] if axis==0 else m.shape[0]
    lo=np.zeros(m.shape[1] if axis==0 else m.shape[0]); hi=lo.copy(); ok=np.zeros_like(lo,bool)
    for i in range(len(lo)):
        line=m[:,i] if axis==0 else m[i,:]; w=np.where(line)[0]
        if len(w): lo[i],hi[i],ok[i]=w[0],w[-1],True
    return lo,hi,ok
def span_map(src_al, tgt_al, axis):
    # Coordinates that stretch each line (0 = column, 1 = row) of the source so its opaque span matches
    # the target's. Spans are smoothed so the map has no kinks.
    tl,th,tok=extents(tgt_al,axis); sl,sh,sok=extents(src_al,axis)
    tl,th=smooth_extent(tl,tok),smooth_extent(th,tok); sl,sh=smooth_extent(sl,sok),smooth_extent(sh,sok)
    H,W=tgt_al.shape; yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
    if axis==0: t=(yy-tl[None,:])/np.maximum(th-tl,1)[None,:]; return xx, (sl[None,:]+t*(sh-sl)[None,:]).astype(np.float32)
    t=(xx-tl[:,None])/np.maximum(th-tl,1)[:,None]; return (sl[:,None]+t*(sh-sl)[:,None]).astype(np.float32), yy
def fit_back(real, tgt):
    # The middle of the photo keeps its true shape (uniform scale, centred), so the print isn't bent;
    # only the outer ~80px bends to meet the outline exactly. The two maps blend smoothly.
    H,W=tgt.shape; yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
    def bb(al): ys,xs=np.where(al>128); return xs.min(),ys.min(),xs.max()+1,ys.max()+1
    X0,Y0,X1,Y1=bb(real[...,3]); x0,y0,x1,y1=bb(tgt)
    sc=((Y1-Y0)/(y1-y0)+(X1-X0)/(x1-x0))/2
    rx=(X0+X1)/2+(xx-(x0+x1)/2)*sc; ry=(Y0+Y1)/2+(yy-(y0+y1)/2)*sc
    _,vy=span_map(real[...,3],tgt,0)                                  # vertical pass
    img1=cv2.remap(real,xx,vy,cv2.INTER_LINEAR,borderValue=0)
    hx,_=span_map(img1[...,3],tgt,1)                                  # horizontal pass
    wy=cv2.remap(vy,hx,yy,cv2.INTER_LINEAR); wx=hx
    dist=cv2.distanceTransform((tgt>128).astype(np.uint8),cv2.DIST_L2,5)
    w=np.clip(1-dist/80,0,1); w=(w*w*(3-2*w)).astype(np.float32)
    mx=(rx*(1-w)+wx*w).astype(np.float32); my=(ry*(1-w)+wy*w).astype(np.float32)
    return cv2.remap(real,mx,my,cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
def plain_fabric(front, thr):
    # The front with its print painted out, mirrored and softly blurred: plain fabric for any spot the
    # back photo doesn't reach.
    rgb=front[...,:3].copy(); al=front[...,3]; m=al>200
    rgb[~m]=np.median(rgb[m],axis=0).astype(np.uint8)
    lab=cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB).astype(np.float32); med=np.median(lab[m],axis=0)
    d=np.sqrt((((lab-med)*np.array([0.5,1,1]))**2).sum(-1))
    pm=cv2.dilate(((d>thr)&m).astype(np.uint8)*255,np.ones((21,21),np.uint8))
    out=cv2.cvtColor(cv2.inpaint(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),pm,12,cv2.INPAINT_TELEA),cv2.COLOR_BGR2RGB)
    out=cv2.GaussianBlur((out*0.9).astype(np.uint8),(0,0),28)
    return out[:,::-1].astype(np.float32)
def bleed(a):
    rgb=a[...,:3].astype(np.float32); known=cv2.erode((a[...,3]>200).astype(np.uint8),np.ones((7,7),np.uint8)).astype(np.float32)
    for _ in range(48):
        w=cv2.boxFilter(known,-1,(3,3),normalize=False); c=cv2.boxFilter(rgb*known[...,None],-1,(3,3),normalize=False)
        new=(w>0)&(known==0); rgb[new]=c[new]/w[new][:,None]; known[new]=1
    out=a.copy(); out[...,:3]=np.clip(rgb,0,255).astype(np.uint8); return out
for slug in ITEMS:
    front=rgba(f'{PREV}/{slug}-front.webp')          # already edge-repainted
    tgt=front[...,3][:,::-1].copy()                    # the back as seen from behind = mirrored front outline
    real=rgba(f'{OUT}/{slug}-back.webp')
    w=fit_back(real,tgt)
    base=plain_fabric(front,ITEMS[slug])
    a=w[...,3:].astype(np.float32)/255
    rgb=w[...,:3]*a+base*(1-a)
    back=np.dstack([rgb,tgt]).astype(np.uint8)
    Image.fromarray(bleed(back)).save(f'{DST}/{slug}-back.webp',quality=88,method=6,exact=True)
    # Depth: pillow profile, gentler at the edges, 4x the detail, 16-bit.
    al=front[...,3]; m=cv2.erode((al>128).astype(np.uint8),np.ones((13,13),np.uint8))  # flat outline band ~6px: two cells of the finer mesh
    d=cv2.distanceTransform(m,cv2.DIST_L2,5); R=d.max()
    h=np.sqrt(np.clip(d*(2*R-d),0,None))/R
    ramp=np.clip(d/45,0,1); ramp=ramp*ramp*(3-2*ramp)  # smoothstep over ~45px: rounded over, not a cliff
    h=cv2.GaussianBlur(h*ramp,(0,0),7)*(m>0)
    h=cv2.resize(h/h.max(),(450,500),interpolation=cv2.INTER_AREA)
    cover=cv2.resize(cv2.dilate((al>20).astype(np.uint8),np.ones((9,9),np.uint8)),(450,500),interpolation=cv2.INTER_AREA)>0
    v=np.where(cover, 257+np.round(h*(65535-257)), 0).astype(np.uint32)   # 257 = flat outline band
    png=np.dstack([(v>>8)&255, v&255, np.zeros_like(v)]).astype(np.uint8)
    Image.fromarray(png).save(f'{DST}/{slug}-depth.png',optimize=True)
    e=cv2.erode((al>128).astype(np.uint8)*255,np.ones((5,5),np.uint8)); edge=np.zeros(al.shape+(4,),np.uint8); edge[...,:3]=255; edge[...,3]=e
    Image.fromarray(edge).save(f'{DST}/{slug}-edge.webp',lossless=True,method=6)
    print(slug,'ok')
