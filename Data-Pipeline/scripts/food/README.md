\# Food pipeline (Gemini)



DAG-ready scripts for the food feature.



Pipeline:

1\) download\_food\_data.py -> downloads Food-101 dataset into data/raw

2\) preprocess\_food\_images.py -> creates manifest + train/val split + class distribution

3\) infer\_food\_gemini.py -> generates predictions JSONL (use --mock for now)



Outputs (written to Data-Pipeline/data/processed):

\- food\_manifest.csv

\- food\_train.csv

\- food\_val.csv

\- food\_class\_distribution.csv

\- food\_predictions.jsonl

