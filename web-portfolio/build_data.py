"""Package existing verified data for the browser. No training or source mutation."""
from pathlib import Path
import csv, json, hashlib, zipfile, shutil
from datetime import datetime

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
DIST=HERE/'dist'
ASSETS=DIST/'assets'
ASSETS.mkdir(parents=True,exist_ok=True)
def rows(path):
    with (ROOT/path).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
preds={r['IncidentID']:r for r in rows('ai-model/incident_ai_predictions.csv')}
times={int(r['Hour']):r for r in rows('data/DimTime.csv')}
columns=['id','date','hour','district','category','status','priority','resolution','sla','repeat','risk','shift','created','assigned','resolved','subcategory','channel','team','split','timeBand']
incidents=[]
for r in rows('data/FactIncidents.csv'):
    p=preds[r['IncidentID']]
    assert r['IncidentID']==p['IncidentID'] and int(r['DistrictKey'])==int(p['DistrictKey'])
    incidents.append([r['IncidentID'],int(r['DateKey']),int(r['Hour']),int(r['DistrictKey']),int(r['CategoryKey']),r['Status'],r['Priority'],float(r['ResolutionHours']) if r['ResolutionHours'] else None,r['SLAMet']=='True',r['IsRepeat']=='True',float(p['PredictedBreachProbability']),p['Shift'],r['CreatedAt'],r['AssignedAt'],r['ResolvedAt'] or None,r['Subcategory'],int(r['ChannelKey']),int(r['TeamKey']),p['ModelSplit'],times[int(r['Hour'])]['TimeBand']])
capacity=[[int(r['DateKey']),int(r['DistrictKey']),r['Shift'],int(r['PlannedTeams']),int(r['AvailableTeams']),int(r['IncidentCapacity'])] for r in rows('data/FactDailyCapacity.csv')]
districts=[{'id':int(r['DistrictKey']),'en':r['DistrictEN'],'ar':r['DistrictAR'],'sector':r['Sector'],'lat':float(r['CenterLat']),'lon':float(r['CenterLon'])} for r in rows('data/DimDistrict.csv')]
categories=[{'id':int(r['CategoryKey']),'en':r['CategoryEN'],'ar':r['CategoryAR']} for r in rows('data/DimCategory.csv')]
metrics=json.loads((ROOT/'ai-model/model_metrics.json').read_text())
drivers=[{'name':r['FeatureGroup'],'importance':float(r['Importance'])} for r in rows('ai-model/feature_group_importance.csv') if float(r['Importance'])>0]
dates=[int(r['DateKey']) for r in rows('data/DimDate.csv')]
payload={'columns':columns,'incidents':incidents,'capacity':capacity,'districts':districts,'categories':categories,'dates':dates,'metrics':{'model':metrics['selected_model'],'threshold':metrics['decision_threshold'],'test':metrics['test_metrics'],'cohorts':metrics['row_counts']},'drivers':drivers,'bounds':{'west':39.53,'east':39.71,'south':24.393,'north':24.528},'sourcePeriod':['2025-10-05','2026-04-05'],'verifiedOn':'2026-10-24','dataClass':'Synthetic'}
(ASSETS/'data.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
pbix=ROOT/'output/Madinah Operations Intelligence - Updated.pbix'
with zipfile.ZipFile(pbix) as z:
    name=next(n for n in z.namelist() if 'madinah-offline-map-background' in n)
    original=z.read(name)
    (ASSETS/'madinah-map.png').write_bytes(original)
    assert hashlib.sha256(original).digest()==hashlib.sha256((ASSETS/'madinah-map.png').read_bytes()).digest()
downloads=DIST/'downloads';downloads.mkdir(exist_ok=True)
for src,name in [('Madinah Operations Intelligence - Dashboard - Updated.pdf','dashboard.pdf'),('Madinah Operations Intelligence - Case Study - Updated.pdf','case-study.pdf')]:
    shutil.copyfile(ROOT/'output/pdf'/src,downloads/name)
shutil.copyfile(pbix,downloads/'madinah-operations.pbix')
manifest={'sourceFiles':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'data/FactIncidents.csv',ROOT/'data/FactDailyCapacity.csv',ROOT/'ai-model/incident_ai_predictions.csv',pbix]},'mapSha256':hashlib.sha256(original).hexdigest(),'rows':len(incidents),'capacityRows':len(capacity),'dataBytes':(ASSETS/'data.json').stat().st_size}
(HERE/'data-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest,indent=2))
