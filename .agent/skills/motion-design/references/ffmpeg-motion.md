# FFmpeg Motion & Video Transitions Reference

## 1. Scene Transitions (`xfade`)

When cross-fading between scenes or headline cards in FFmpeg:
```bash
# Smooth horizontal wipe transition (1.0 second offset at t=4s)
ffmpeg -i scene1.mp4 -i scene2.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=wipeleft:duration=0.8:offset=4[v]" \
  -map "[v]" output.mp4
```

Common `xfade` transition styles:
* `fade` / `fadeblack` / `fadewhite`
* `wipeleft` / `wiperight` / `wipeup`
* `slideleft` / `slideright` / `smoothleft`
* `circlecrop` / `radial` / `dissolve`

---

## 2. Dynamic Text & Headline Motion (`drawtext`)

### Continuous Scrolling Marquee Ticker:
```bash
-filter_complex "drawtext=text='BREAKING NEWS':fontcolor=white:fontsize=36:x=w-mod(max(t-1\,0)*(w+text_w)/10\,w+text_w):y=h-60"
```

### Fade-In Headline with Slide-Up:
```bash
# Fade in from t=0.5 to t=1.0 and slide up from y=600 to y=520
-filter_complex "drawtext=text='Special Report':fontsize=48:fontcolor=white:alpha='if(lt(t,0.5),0,if(lt(t,1.0),(t-0.5)/0.5,1))':x=(w-text_w)/2:y='if(lt(t,0.5),600,if(lt(t,1.0),600-(80*(t-0.5)/0.5),520))'"
```

---

## 3. Ken Burns Zoom & Pan Effect (`zoompan`)

```bash
# Smooth slow zoom into center (1.0x to 1.15x over 150 frames)
-filter_complex "zoompan=z='min(zoom+0.001,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1080x1920:fps=30"
```

