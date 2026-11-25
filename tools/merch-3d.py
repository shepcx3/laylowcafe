# Makes the 3D files for the merch page from each item's cut-out photos.
#
#   python3 tools/merch-3d.py SRC_DIR assets/img/merch
#
# SRC_DIR holds NAME-front.webp and NAME-back.webp for every item in SLUGS: 900x1000, transparent
# background, item centred. For an item with only a front photo, make NAME-back.webp by mirroring the
# front (with any print painted out). Writes, for each item: NAME-front.webp and NAME-back.webp (edges
# repainted in the item's colour), NAME-edge.webp (the flat fallback's edge mask) and NAME-depth.png
# (how puffy the 3D model is at each point). Needs: pip install numpy opencv-python-headless pillow
from PIL import Image
OUT, DST = sys.argv[1], sys.argv[2]
SLUGS=['hoodie','crewneck','tee-sage','tee-grey','cap','script-cap','tote-black','tote-cream','tote-green']
REAL_BACK={'hoodie':36,'tee-sage':30,'tee-grey':30}  # slug: print threshold for the plain base
def rgba(p): return np.array(Image.open(p).convert('RGBA'))
def plain_back(a, thr):
    rgb=a[...,:3].copy(); al=a[...,3]; m=al>200
    rgb[~m]=np.median(rgb[m],axis=0).astype(np.uint8)
    lab=cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB).astype(np.float32); med=np.median(lab[m],axis=0)
    d=np.sqrt((((lab-med)*np.array([0.5,1,1]))**2).sum(-1))
    pm=cv2.dilate(((d>thr)&m).astype(np.uint8)*255,np.ones((21,21),np.uint8))
    out=cv2.cvtColor(cv2.inpaint(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),pm,12,cv2.INPAINT_TELEA),cv2.COLOR_BGR2RGB)
    return np.dstack([(out*0.9).astype(np.uint8),al])[:,::-1].copy()
def bleed(a):
    # Fill the colour under transparent pixels with the nearest item colour, so texture filtering at the
    # edges of the 3D model never pulls in the white photo background.
    rgb=a[...,:3].astype(np.float32); known=cv2.erode((a[...,3]>200).astype(np.uint8),np.ones((7,7),np.uint8)).astype(np.float32)  # also repaint the pale rim left by the photo background
    for _ in range(48):
        w=cv2.boxFilter(known,-1,(3,3),normalize=False); c=cv2.boxFilter(rgb*known[...,None],-1,(3,3),normalize=False)
        new=(w>0)&(known==0); rgb[new]=c[new]/w[new][:,None]; known[new]=1
    out=a.copy(); out[...,:3]=np.clip(rgb,0,255).astype(np.uint8); return out
def bbox(al):
    ys,xs=np.where(al>128); return xs.min(),ys.min(),xs.max()+1,ys.max()+1
for slug in SLUGS:
    f=rgba(f'{OUT}/{slug}-front.webp')
    if slug in REAL_BACK:
        base=plain_back(f,REAL_BACK[slug]); real=rgba(f'{OUT}/{slug}-back.webp')
        base[...,:3]=cv2.GaussianBlur(base[...,:3],(0,0),28)  # plain fabric where the real back photo doesn't reach
        x0,y0,x1,y1=bbox(base[...,3]); X0,Y0,X1,Y1=bbox(real[...,3])
        r=cv2.resize(real[Y0:Y1,X0:X1],(x1-x0,y1-y0),interpolation=cv2.INTER_AREA).astype(np.float32)
        b=base.astype(np.float32); reg=b[y0:y1,x0:x1]; ra=r[...,3:]/255
        reg[...,:3]=r[...,:3]*ra+reg[...,:3]*(1-ra); b[y0:y1,x0:x1]=reg
        Image.fromarray(bleed(b.astype(np.uint8))).save(f'{DST}/{slug}-back.webp',quality=84,method=6,exact=True)
    else:
        Image.fromarray(bleed(rgba(f'{OUT}/{slug}-back.webp'))).save(f'{DST}/{slug}-back.webp',quality=84,method=6,exact=True)
    Image.fromarray(bleed(f)).save(f'{DST}/{slug}-front.webp',quality=84,method=6,exact=True)
    al=f[...,3]
    back_al=rgba(f'{DST}/{slug}-back.webp')[...,3][:,::-1]
    e=cv2.erode(((np.minimum(al,back_al))>128).astype(np.uint8)*255,np.ones((5,5),np.uint8))
    out=np.zeros(al.shape+(4,),np.uint8); out[...,:3]=255; out[...,3]=e
    Image.fromarray(out).save(f'{DST}/{slug}-edge.webp',lossless=True,method=6)
    # Depth: inflate the silhouette like a pillow (round cross-section), smoothed so there are no creases.
    m=(cv2.erode((al>128).astype(np.uint8),np.ones((21,21),np.uint8)))  # puff starts ~10px inside the outline: a flat band at least two mesh cells wide where front and back meet
    d=cv2.distanceTransform(m,cv2.DIST_L2,5); R=d.max()
    h=np.sqrt(np.clip(d*(2*R-d),0,None))/R
    h=cv2.GaussianBlur(h,(0,0),9)*np.clip(d/14,0,1)**0.5  # back to exactly 0 at the outline, so front and back meet
    h=cv2.resize(h/h.max(),(225,250),interpolation=cv2.INTER_AREA)
    h8=(h*255).round().astype(np.uint8)
    cover=cv2.resize(cv2.dilate((al>20).astype(np.uint8),np.ones((9,9),np.uint8)),(225,250),interpolation=cv2.INTER_AREA)>0
    h8[cover&(h8==0)]=1  # 1 = flat edge band: still part of the model, so the outline has no holes
    Image.fromarray(h8).save(f'{DST}/{slug}-depth.png',optimize=True)
    print(slug, 'R px', round(float(R)))
