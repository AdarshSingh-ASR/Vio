# Production deployment

## Recommended: one Google Cloud control plane

Vio can be released with one Cloud Build submission. The repository-level `cloudbuild.yaml` builds and deploys:

- `vio-web`: the Next.js UI and authenticated BFF on Cloud Run.
- `vio-agent`: the private Agno/FastAPI service on Cloud Run.
- `vio-migrate`: a Cloud Run Job that applies checksum-verified SQL migrations before new application revisions are deployed.
- `vio-evaluations` and `vio-ingestion`: Cloud Tasks queues for durable background work.

Vertex AI, KMS, Secret Manager, Artifact Registry, Cloud Logging, and Cloud Tasks stay in the same Google Cloud project. TiDB and Appwrite are managed data dependencies; they are not additional Vio application deployments.

The services remain separate containers for security and scaling, but they are built, migrated, deployed, and wired by one command and one release record.

## One-time project bootstrap

Enable APIs and create the repository and service accounts:

```bash
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com aiplatform.googleapis.com cloudtasks.googleapis.com cloudkms.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create vio --repository-format=docker --location=us-central1
gcloud iam service-accounts create vio-web
gcloud iam service-accounts create vio-agent
gcloud iam service-accounts create vio-tasks
```

Grant only the permissions each identity needs:

- `vio-web`: Cloud Tasks enqueuer, KMS encrypt/decrypt, Secret Manager accessor, Cloud Run invoker for `vio-agent`.
- `vio-agent`: Vertex AI user, Secret Manager accessor, Cloud SQL/TiDB network access as applicable.
- `vio-tasks`: Cloud Run invoker for the web and agent services.
- Cloud Build service account: Artifact Registry writer, Cloud Run admin, Cloud Tasks admin, IAM service-account user, and Secret Manager accessor.

Create the KMS key and these Secret Manager secrets with real values:

- `vio-agent-shared-secret` — at least 32 random bytes.
- `vio-appwrite-api-key`.
- `vio-tidb-host`, `vio-tidb-user`, `vio-tidb-password`, `vio-tidb-database`.
- `vio-agno-database-url` — the URL-encoded PyMySQL connection URL used by Agno.

The Appwrite project must have documents, images, and videos buckets with file security enabled and no bucket-wide public permissions. Add the final Cloud Run origin as an Appwrite web platform.

Built-in OpenAI/Groq fallback and the optional OpenRouter gateway remain disabled when their keys are absent. To enable them, create the corresponding secrets and update the private agent service after its first deployment:

```bash
gcloud run services update vio-agent --region us-central1 \
  --update-secrets OPENAI_API_KEY=vio-openai-api-key:latest,GROQ_API_KEY=vio-groq-api-key:latest,OPENROUTER_API_KEY=vio-openrouter-api-key:latest \
  --update-env-vars OPENAI_MODEL=gpt-5.6,GROQ_MODEL=llama-3.3-70b-versatile,OPENROUTER_MODELS=YOUR_ORDERED_MODEL_LIST
```

Omit any provider you do not operate. Vertex remains the built-in primary provider, and user-funded OpenAI requests do not cross to built-in billing unless the user explicitly enables that fallback.

## Release

Capture and verify a TiDB snapshot first. Then submit the complete release:

```bash
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=us-central1,_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1,_APPWRITE_PROJECT_ID=YOUR_PROJECT,_FILES_BUCKET_ID=YOUR_FILES_BUCKET,_IMAGES_BUCKET_ID=YOUR_IMAGES_BUCKET,_VIDEOS_BUCKET_ID=YOUR_VIDEOS_BUCKET
```

The build stops if migrations fail. It deploys immutable images tagged with the Cloud Build ID, keeps the agent private, configures OIDC from the web service to the agent, creates both queues, and grants their invocation identities.

After the first release, add the generated `vio-web` URL to Appwrite and run the live gates in `docs/TESTING.md`. A custom domain can be mapped to `vio-web` without changing the service topology.

## Optional Vercel topology

The Next.js service can instead run on Vercel, while the agent and background infrastructure remain on Google Cloud. Learning Script Studio and its native renderers have been removed, so the web application itself is Vercel-compatible. This topology has two deployment control planes and is not the recommended "deploy the whole application together" option.

## Rollback

1. Pause the Cloud Tasks queues.
2. Route Cloud Run traffic back to the prior immutable web and agent revisions.
3. Restore the verified pre-release TiDB snapshot if the migration is not forward-compatible.
4. Verify authentication, classroom authorization, file access, chat streaming, and queue health.
5. Resume queues only after failed task identifiers and audit events have been inspected. Never copy prompts, keys, or submission contents into incident logs.
