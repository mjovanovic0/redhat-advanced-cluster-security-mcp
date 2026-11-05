# Building on OpenShift with Tekton

`tekton/pipeline.yaml` builds the container image on OpenShift Pipelines and pushes it to
the OpenShift internal registry. It clones the repository, then runs `buildah` on the
`Containerfile`. The Containerfile generates the RHACS API spec for the version you choose
(`ACS_VERSION` build arg).

## Prerequisites

- The OpenShift Pipelines operator (1.14 or later). The pipeline uses the `git-clone` and
  `buildah` tasks the operator installs in the `openshift-pipelines` namespace, through the
  cluster resolver.
- Build pods need outbound access, directly or through a proxy (see [Proxy](#proxy)), to
  `github.com`, `registry.access.redhat.com`, `cdn-ubi.redhat.com`, `registry.npmjs.org` and
  `mirror.openshift.com` (for the RHACS OpenAPI spec).

## Proxy

If the cluster reaches the internet through a proxy, set it in `tekton/pipelinerun.yaml` under
`spec.taskRunTemplate.podTemplate.env` (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` and their lowercase
forms; different tools read different cases). These variables are set on every step container:

- `git-clone` uses them to reach the Git server.
- `buildah` uses them to pull the UBI base images and passes them on to the Containerfile `RUN`
  steps, so `dnf`, `npm ci` and the RHACS spec download (done with `curl` when a proxy is set)
  go through the proxy as well.

`NO_PROXY` must include the internal registry (`.svc` covers
`image-registry.openshift-image-registry.svc`), or the push is sent to the proxy and fails.
Adjust the service/cluster network CIDRs in the example to your cluster
(`oc get network.config cluster -o jsonpath='{.spec}'`). The cluster-wide proxy settings
(`oc get proxy cluster -o yaml`) are a good source for these values.

If the proxy intercepts TLS with its own CA, the build also has to trust that CA. That is not
covered here.

Remove the `podTemplate` block if the cluster has direct internet access.

## Install the pipeline

```bash
oc new-project rhacs-mcp          # or use an existing namespace
oc apply -f tekton/pipeline.yaml
```

The operator creates a `pipeline` service account in every namespace. It can push to the
internal registry in its own namespace; the `rhacs-mcp` ImageStream is created on the first push.

## Run a build

```bash
oc create -f tekton/pipelinerun.yaml
```

Edit the `params` (and the proxy, see above) in `tekton/pipelinerun.yaml` to choose the RHACS version and image tag, then follow
the run with `tkn pipelinerun logs -f -L` or in the console under Pipelines.

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `git-url` | this repository | Repository to build |
| `git-revision` | `main` | Branch, tag or commit |
| `acs-version` | `4.11.6` | RHACS version whose API spec is bundled; match your Central |
| `image` | `image-registry.openshift-image-registry.svc:5000/<namespace>/rhacs-mcp` | Image repository (no tag) |
| `image-tag` | `latest` | Tag to push |

The pipeline returns `IMAGE_URL`, `IMAGE_DIGEST` and `COMMIT` as results.

## Pulling the image

Inside the cluster, use
`image-registry.openshift-image-registry.svc:5000/<namespace>/rhacs-mcp:<tag>`.
From outside, expose the registry route and log in with `oc registry login`, then pull
`$(oc registry info --public)/<namespace>/rhacs-mcp:<tag>`.
