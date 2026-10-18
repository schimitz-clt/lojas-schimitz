import json,sys,statistics as st
names=sys.argv[1:]
for n in names:
  rows=[]
  for i in (1,2,3):
    try: s=json.load(open(f'../{n}-run{i}/swipe.json')); t=json.load(open(f'../{n}-run{i}/trace-summary.json'))
    except Exception as e: continue
    rows.append(dict(dropRaf=s['droppedFramesRaf'],worst=s['worstFrameMs'],longTasks=s['longTasks'],mut=s['carouselDomMutations'],script=s['mainThread']['scriptMs'],layout=s['mainThread']['layoutMs'],style=s['mainThread']['styleMs'],task=s['mainThread']['taskMs'],dropScroll=t['framesDroppedDuringScroll'],gsuP95=t['eventLatencyMs']['GESTURE_SCROLL_UPDATE']['p95'],tmP95=t['eventLatencyMs']['TOUCH_MOVED']['p95'],paint=t['traceDurationsMs'].get('Paint',0),final=s['scrollLeftAfterEachSwipe'][-1],errs=len([e for e in s['jsErrors'] if '401' not in e])))
  print(n, len(rows), 'runs')
  for k in rows[0]: print('  %-10s'%k, [r[k] for r in rows], 'median', st.median([r[k] for r in rows]))
