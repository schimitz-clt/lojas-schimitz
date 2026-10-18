import json,sys,collections,statistics
d=sys.argv[1]
t=json.load(open(d+'/trace.json')); ev=t['traceEvents'] if isinstance(t,dict) else t
pr=[e['args']['frame_reporter'] for e in ev if e['name']=='PipelineReporter' and e.get('ph')=='b' and 'frame_reporter' in e.get('args',{})]
scroll=[f for f in pr if f.get('scroll_state') not in (None,'SCROLL_NONE')]
res={'framesTotal':len(pr),'framesDroppedTotal':sum(f['state']=='STATE_DROPPED' for f in pr),
 'framesDuringScroll':len(scroll),'framesDroppedDuringScroll':sum(f['state']=='STATE_DROPPED' for f in scroll),
 'framesDuringScrollMissingContent':sum(bool(f.get('has_missing_content') or f.get('checkerboarded_needs_raster')) for f in scroll),
 'scrollStates':dict(collections.Counter(f.get('scroll_state') for f in scroll))}
# event latency per type
op={};lat=collections.defaultdict(list)
for e in ev:
  if e['name']!='EventLatency': continue
  k=(e.get('pid'),e.get('id2',{}).get('local'))
  if e['ph']=='b': op[k]=(e['ts'],e['args']['event_latency']['event_type'])
  elif e['ph']=='e' and k in op:
    ts,ty=op.pop(k); lat[ty].append((e['ts']-ts)/1000)
res['eventLatencyMs']={k:{'n':len(v),'median':round(statistics.median(v),1),'p95':round(sorted(v)[int(len(v)*.95)-1 if len(v)>1 else 0],1),'max':round(max(v),1)} for k,v in lat.items()}
# main thread task time on renderer main
dur=collections.Counter()
for e in ev:
  if e.get('ph')=='X' and e['name'] in ('FunctionCall','EventDispatch','Layout','UpdateLayoutTree','Paint','PrePaint','Layerize','TimerFire','FireAnimationFrame','Decode Image','ImageDecodeTask','RasterTask','ParseHTML','RunTask'):
    dur[e['name']]+=e.get('dur',0)/1000
res['traceDurationsMs']={k:round(v,1) for k,v in dur.items()}
json.dump(res,open(d+'/trace-summary.json','w'),indent=2); print(json.dumps(res,indent=2))
