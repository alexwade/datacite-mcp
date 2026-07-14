​​DataCite Resolution Logs → Data Warehouse Plan  
*Status: Proposed  |  Version: 0.2*

First draft Apr 29, 2026;  Updated May 30, 2026  
[Alex Wade](mailto:alexdwade@gmail.com) 

# 1\. Background

CNRI generates logs for every DataCite DOI resolution processed. The log files are delivered as gzip-compressed flat files into DataCite’s Amazon S3, one or more files per region per month. As of March 2026, there are \>500 M resolution requests per month that are logged.

The goal is to load these logs into a data warehouse that supports low-cost, ad hoc SQL queries,  for example, resolution counts by DOI prefix, aggregations by user-agent or referrer, etc..  Future work could see the monthly [https://stats.datacite.org](https://stats.datacite.org) resolutions tab be refactored to use (perhaps cached) queries against this database.  

# 2\. Log Format

Each log line contains 10 space-delimited fields. The last three are double-quoted string fields and may be empty:

| \# | Field | Type | Example |
| :---- | :---- | :---- | :---- |
| 1 | client\_ip | string | 192.122.133.26 |
| 2 | protocol | string | HTTP:HDL |
| 3 | timestamp | string (quoted) | "2025-01-01 00:00:00.740Z" |
| 4 | request\_count | int | 1 |
| 5 | response\_code | int | 1 (success) or 100 (not found) |
| 6 | duration | int \+ suffix | 325ms |
| 7 | doi | string | 10.48550/arXiv.9712246 |
| 8 | referrer\_handle | string (quoted) | "" |
| 9 | referrer\_url | string (quoted) | "" |
| 10 | user\_agent | string (quoted) | "python-requests/2.32.3" |

Observed protocols: HTTP:HDL (99.9%) and HTTP:HDLApi (\<0.1%). Response codes 1 (RC\_SUCCESS) and 100 (RC\_HANDLE\_NOT\_FOUND) are the two values seen in practice.

# 3\. Recommendation: Athena \+ S3 Parquet

For purely ad hoc SQL queries at this data volume, Amazon Athena with data stored as Snappy-compressed Parquet on S3 is much cheaper than Redshift. There is no always-on cluster to pay for; you only pay $5 per TB scanned, and columnar Parquet with partition pruning means most queries scan a small fraction of each month's data.

|   | Athena \+ S3 Parquet | Redshift Serverless |
| :---- | :---- | :---- |
| Storage cost | \~$23/TB/month (S3 standard) | \~$182/TB/month (managed storage) |
| Query cost | $5/TB scanned | \~$0.36/RPU-hour while running |
| 2B rows/month (est. 400 GB Parquet) | \~$2/month storage | $73+/month storage alone |
| Idle cost | $0 | $0 (serverless) |
| Best for | Occasional ad hoc SQL, low ops overhead | High-concurrency BI dashboards |

Parquet compression achieves roughly 10:1 over raw text for this log format, so 43 GB raw (10 regions × 4.3 GB) becomes \~4.3 GB/month of Parquet. A full-month table scan in Athena costs about $0.02.

# 4\. Architecture

s3://datacite-logs/YYYYMM/\<file\>.gz  (new upload)  
        │  
        │  S3 Event Notification  
        ▼  
Lambda orchestrator  (chunk\_and\_process logic)  
  \- streams .gz from S3  
  \- round-robins lines into N gzip chunk files  
  \- uploads chunks to s3://datacite-logs/YYYYMM/chunks/  
  \- launches N Fargate tasks in parallel  
        │  
        ├── Fargate task 0  →  \<file\>-chunk-000.parquet  
        ├── Fargate task 1  →  \<file\>-chunk-001.parquet  
        ├── ...  
        └── Fargate task N  →  \<file\>-chunk-00N.parquet  
                │  
                │  all land in the same Hive partition directory  
                ▼  
s3://datacite-logs-processed/datacite-logs/year=YYYY/month=M/region=\<region\>/  
        │  
        │  MSCK REPAIR TABLE  (or partition projection)  
        ▼  
Athena  datacite.resolution\_logs

 

New log files trigger processing automatically:

* S3 Event Notification fires on each new .gz upload to the raw bucket  
* Lambda receives the S3 event and orchestrates chunking and Fargate threads  
* Fargate writes Snappy-compressed Parquet to the processed bucket, partitioned by year/month/region  
* Athena MSCK REPAIR TABLE (or partition projection) makes new partitions queryable immediately

# 5\. Fargate ETL Function

The processor runs as an AWS Lambda function (lambda/log\_processor.py). It streams gzip decompression via GzipFile(fileobj=...) so the full 4.3 GB file is never held in memory at once. Rows are flushed to the Parquet writer in batches of 500,000, keeping peak RAM around 600 MB. Recommended Lambda config: 1024 MB memory, 300-second timeout. Requires a Lambda layer or container image with pyarrow installed.

\# lambda/log\_processor.py  
import boto3, gzip, io, os, re, urllib.parse  
from datetime import datetime, timezone  
import pyarrow as pa  
import pyarrow.parquet as pq  
   
OUTPUT\_BUCKET \= os.environ\["OUTPUT\_BUCKET"\]  
ROW\_GROUP\_SIZE \= 500\_000  
   
LOG\_RE \= re.compile(  
    r'^(\\S+)\\s+(\\S+)\\s+"(\[^"\]+)"\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)ms\\s+'  
    r'(\\S+)\\s+"(\[^"\]\*)"\\s+"(\[^"\]\*)"\\s+"(\[^"\]\*)"'  
)  
   
SCHEMA \= pa.schema(\[  
	("client\_ip", pa.string()), ("protocol", pa.string()),  
	("ts", pa.timestamp("ms", tz="UTC")),  
	("request\_count", pa.int32()), ("response\_code", pa.int16()),  
	("duration\_ms", pa.int32()), ("doi", pa.string()),  
	("referrer\_handle", pa.string()), ("referrer\_url", pa.string()),  
	("user\_agent", pa.string()),  
	("year", pa.int16()), ("month", pa.int8()), ("region", pa.string()),  
\])  
   
def \_flush(writer, batch):  
	if batch\["doi"\]:  
    	writer.write\_table(pa.table(batch, schema=SCHEMA))  
    	for v in batch.values(): v.clear()  
   
def process(s3, input\_bucket, key):  
	region \= "-".join(key.split("/")\[-1\].replace(".gz","").split("-")\[4:\]) or "unknown"  
	body \= s3.get\_object(Bucket=input\_bucket, Key=key)\["Body"\]  
	out\_buf, batch \= io.BytesIO(), {n: \[\] for n in SCHEMA.names}  
	writer \= pq.ParquetWriter(out\_buf, SCHEMA, compression="snappy")  
	year \= month \= None  
	row\_count \= 0  
	with gzip.GzipFile(fileobj=body) as gz:  
    	for raw in io.TextIOWrapper(gz, encoding="utf-8", errors="replace"):  
        	m \= LOG\_RE.match(raw.rstrip())  
        	if not m: continue  
        	ts \= datetime.strptime(m.group(3), "%Y-%m-%d %H:%M:%S.%fZ").replace(  
            	tzinfo=timezone.utc)  
        	if year is None: year, month \= ts.year, ts.month  
            batch\["client\_ip"\].append(m.group(1)); batch\["protocol"\].append(m.group(2))  
        	batch\["ts"\].append(ts)  
            batch\["request\_count"\].append(int(m.group(4)))  
            batch\["response\_code"\].append(int(m.group(5)))  
            batch\["duration\_ms"\].append(int(m.group(6)))  
            batch\["doi"\].append(m.group(7))  
            batch\["referrer\_handle"\].append(m.group(8) or None)  
            batch\["referrer\_url"\].append(m.group(9) or None)  
            batch\["user\_agent"\].append(m.group(10) or None)  
            batch\["year"\].append(ts.year); batch\["month"\].append(ts.month)  
            batch\["region"\].append(region)  
        	row\_count \+= 1  
        	if row\_count % ROW\_GROUP\_SIZE \== 0: \_flush(writer, batch)  
	\_flush(writer, batch); writer.close()  
	stem \= key.split("/")\[-1\].replace(".gz","").replace(".log","")  
	out\_key \= f"datacite-logs/year={year}/month={month:02d}/region={region}/{stem}.parquet"  
	out\_buf.seek(0)  
	s3.put\_object(Bucket=OUTPUT\_BUCKET, Key=out\_key, Body=out\_buf.read())  
	print(f"OK {out\_key} rows={row\_count}")  
   
def handler(event, context):  
	s3 \= boto3.client("s3")  
	for r in event\["Records"\]:  
    	process(s3, r\["s3"\]\["bucket"\]\["name"\],  
                urllib.parse.unquote\_plus(r\["s3"\]\["object"\]\["key"\]))

# 6\. Athena Table DDL

CREATE DATABASE IF NOT EXISTS datacite;  
   
CREATE EXTERNAL TABLE IF NOT EXISTS datacite.resolution\_logs (  
  client\_ip   	STRING,  
  protocol    	STRING,  
  ts          	TIMESTAMP,  
  request\_count   INT,  
  response\_code   SMALLINT,  
  duration\_ms 	INT,  
  doi         	STRING,  
  referrer\_handle STRING,  
  referrer\_url	STRING,  
  user\_agent  	STRING  
)  
PARTITIONED BY (  
  year   INT,  
  month  INT,  
  region STRING  
)  
STORED AS PARQUET  
LOCATION 's3://datacite-logs-processed/datacite-logs/'  
TBLPROPERTIES ('parquet.compress' \= 'SNAPPY');  
   
\-- Run after each batch of new Parquet files is written:  
MSCK REPAIR TABLE datacite.resolution\_logs;

# 7\. Example Queries

Successful resolutions by DOI prefix for a given month:

SELECT substr(doi, 1, instr(doi, '/') \- 1\) AS prefix,  
   	count(\*) AS resolutions  
FROM datacite.resolution\_logs  
WHERE year \= 2025 AND month \= 1  
  AND response\_code \= 1  
GROUP BY 1  
ORDER BY 2 DESC  
LIMIT 50;  
 

p95 resolution latency by region:

SELECT region,  
   	approx\_percentile(duration\_ms, 0.95) AS p95\_ms  
FROM datacite.resolution\_logs  
WHERE year \= 2025 AND month \= 1  
GROUP BY region  
ORDER BY p95\_ms DESC;  
 

Not-found rate (RC 100\) trend by month:

SELECT year, month,  
   	countif(response\_code \= 100\) AS not\_found,  
   	count(\*) AS total,  
   	round(100.0 \* countif(response\_code \= 100\) / count(\*), 2\) AS pct\_not\_found  
FROM datacite.resolution\_logs  
GROUP BY year, month  
ORDER BY year, month;

# 8\. Cost Estimate

Assumes 10 regions, \~18M rows/region/month, 4.3 GB raw per file:

| Item | Monthly Estimate |
| :---- | :---- |
| Raw log storage on S3 (43 GB gzip, Standard) | \~$1.00 |
| Parquet output on S3 (\~4.3 GB Snappy) | \~$0.10 |
| Glue Python Shell job (10 files × 5 min, 1 DPU each) | \~$2.20 |
| Lambda triggers (negligible) | \<$0.01 |
| Athena — full-month scan (4.3 GB Parquet) | \~$0.02 per query |
| Athena — single-partition scan (\~400 MB) | \~$0.002 per query |
| Total ongoing (storage \+ ETL) | \~$3–4/month |

A team running 50 ad hoc queries/month against a single month's data would pay approximately $4–5/month in total. Redshift Serverless with equivalent storage would cost $73+/month in storage fees alone, before any query time.

# 9\. Rollout Steps

Phase 1 — Manual backfill:

* Create S3 buckets: datacite-logs-raw and datacite-logs-processed  
* Upload existing .gz log files to datacite-logs-raw/  
* Test lambda/log\_processor.py locally against a sample file (set OUTPUT\_BUCKET env var, pass a mock S3 event)  
* Run CREATE TABLE and MSCK REPAIR TABLE in Athena console  
* Validate row counts and spot-check a few queries

Phase 2 — Automation:

* Package Lambda with a PyArrow layer (or container image: python:3.12 \+ pip install pyarrow boto3)  
* Deploy Lambda with 1024 MB memory, 300s timeout, OUTPUT\_BUCKET env var  
* Add S3 Event Notification on the raw bucket (ObjectCreated) → Lambda ARN  
* Monitor via CloudWatch Logs; set a duration alarm at 250s as an early-warning for timeout 

Phase 3 — Ongoing:

* New monthly files appear automatically in S3 and are processed within minutes  
* Use Athena Workgroups to set per-query scan limits and alert on cost  
* Consider adding a result cache (Athena result reuse) for repeated identical queries

# 10\. Decision Points

| \# | Decision | Recommendation | Alternative |
| :---- | :---- | :---- | :---- |
| 1 | Query engine | Athena (serverless, pay-per-scan) | Redshift Serverless (better for high concurrency) |
| 2 | File format | Parquet \+ Snappy | ORC (similar performance, less tooling) |
| 3 | Partitioning | year / month / region | Add day partition if querying single days often |
| 4 | ETL runtime | Lambda (1 GB, 300s, streaming) | Glue Python Shell (if files regularly exceed 10 GB) |
| 5 | Trigger mechanism | S3 Event → Lambda → Glue | EventBridge Scheduler for nightly batch |
| 6 | Partition discovery | MSCK REPAIR TABLE (simple) | Partition projection (faster, zero maintenance) |
| 7 | Data retention | Keep raw .gz indefinitely (cheap) | Lifecycle to Glacier after 12 months |
| 8 | Access control | IAM roles for Glue and Athena | Lake Formation for column-level security if needed |

 

 

