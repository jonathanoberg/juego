import json, math, sys
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
j=json.load(open(sys.argv[1] if len(sys.argv)>1 else '/tmp/iceland-generated.json'));fixture=json.load(open(j.get('fixturePath','prototyping/fixtures/iceland-terrain.json')))
bounds=j['bounds'];xmin,ymin,xmax,ymax=bounds
scale=860/(xmax-xmin);plot_height=(ymax-ymin)*scale
second_y=round(100+plot_height+110);canvas_height=round(second_y+plot_height+120)
im=Image.new('RGB',(1000,canvas_height),'#f5f4ee');d=ImageDraw.Draw(im)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=ImageFont.truetype(fontpath,16);small=ImageFont.truetype(fontpath,13);title=ImageFont.truetype(fontpath,23)
ox=70
corners=[(1,0),(.5,math.sqrt(3)/2),(-.5,math.sqrt(3)/2),(-1,0),(-.5,-math.sqrt(3)/2),(.5,-math.sqrt(3)/2)]
bounds=j['bounds'];xmin,ymin,xmax,ymax=bounds
lo=min(c['relativeHeightM'] for c in j['cells']);hi=max(c['relativeHeightM'] for c in j['cells'])
def blend(a,b,t):return tuple(round(x*(1-t)+y*t) for x,y in zip(a,b))
def point(x,y,oy):return (ox+(x-xmin)*scale,oy+(ymax-y)*scale)
for panel,oy in enumerate([100,second_y]):
 d.text((ox,oy-43),'Surface: ground, vegetation and water' if not panel else 'Relative relief: synthetic ground heights' if j.get('objects') else 'Relative relief: synthetic heights and explicit cliff steps',font=title,fill='#233440')
 for c in j['cells']:
  surf=c['surface'];h=c['relativeHeightM'];density=surf['vegetationDensity']
  if panel:color=blend((45,83,124),(229,183,88),(h-lo)/(hi-lo))
  else:
   base=(140,127,113) if surf['substrate']=='rock-and-soil' else (162,138,116)
   if surf['substrate']=='exposed-rock':base=(102,108,114)
   color=(38,137,186) if surf['waterPresent'] else blend(base,(80,157,68),density)
  poly=[point(c['x']+dx,c['y']+dy,oy) for dx,dy in corners];d.polygon(poly,fill=color)
 if not panel:
  for tree in j.get('objects',[]):
   tx,ty=point(tree['x'],tree['y'],oy);radius=tree['crownRadiusM']*scale
   d.ellipse((tx-radius,ty-radius,tx+radius,ty+radius),fill='#35573b',outline='#1f3c29')
   d.ellipse((tx-radius*.6,ty-radius*.6,tx+radius*.6,ty+radius*.6),fill='#507e48')
 # Draw continuously authored water geometry, which can be narrower than cell spacing.
 for feat in fixture['terrainFeatures']:
  if feat['kind'] in ['watercourse'] and feat['state'].get('waterPresent')=='probable':
   pts=[point(x,y,oy) for x,y in feat['geometry']['coordinates']]
   width=feat['properties'].get('channelWidthM',[.5,1]);d.line(pts,fill=(25,115,169),width=max(1,round(sum(width)/2*scale)))
  if panel and feat['kind']=='escarpment':d.line([point(x,y,oy) for x,y in feat['geometry']['coordinates']],fill='#522d31',width=2)
 px,py=point(0,0,oy);d.line((px-6,py,px+6,py),fill='#fff',width=2);d.line((px,py-6,px,py+6),fill='#fff',width=2);d.text((px+9,py+3),'(0,0)',font=small,fill='white',stroke_width=1,stroke_fill='#333')
 d.rectangle([point(xmin,ymax,oy),point(xmax,ymin,oy)],outline='#233440',width=1)
 for x in [-100,-50,0,50,100]:
  px,py=point(x,ymin,oy);d.line((px,py,px,py+5),fill='#333');d.text((px-14,py+8),str(x),font=small,fill='#333')
 if panel:
  y=oy+plot_height+35
  for i in range(180):d.line((ox+i,y,ox+i,y+12),fill=blend((45,83,124),(229,183,88),i/179))
  d.text((ox,y+17),f'{lo:.1f} m',font=small,fill='#333');d.text((ox+137,y+17),f'{hi:.1f} m',font=small,fill='#333')
  d.text((ox+250,y),'Arbitrary zero; tree heights are separate from terrain.' if j.get('objects') else 'Arbitrary zero; red-brown lines mark authored cliffs.',font=small,fill='#333')
 else:d.text((ox,oy+plot_height+35),'Dense vegetation → green | Exposed ground → brown/gray | Water → blue',font=f,fill='#333')
d.text((70,18),j.get('title','Iceland terrain-generation prototype'),font=title,fill='#233440')
d.text((70,48),f"{xmax-xmin:.1f} × {ymax-ymin:.1f} m · {len(j['cells']):,} cells · {len(j.get('objects',[]))} trees · seed {j['prototype']['seed']}",font=f,fill='#444')
d.text((70,canvas_height-25),'Heights, basin depths and generated objects are illustrative inputs, not surveyed image measurements.',font=small,fill='#555')
im.quantize(colors=128).save(sys.argv[2] if len(sys.argv)>2 else 'docs/examples/iceland-generated-terrain.png')
