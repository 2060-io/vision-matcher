# vision-matcher Helm Chart

## Overview

This Helm chart deploys a vision-matcher.

It includes:

- **StatefulSet**: Deploys vision-matcher with the specified number of replicas.
- **Service**: A headless Service to expose vision-matcher.

## Installation

### 1. Lint the Chart

```bash
helm lint ./deployments/vision-matcher
```

### 2. Render Templates

```bash
helm template <release-name> ./deployments/vision-matcher --namespace <your-namespace>
```

### 3. Dry-Run Installation

```bash
helm install --dry-run --debug <release-name> ./deployments/vision-matcher --namespace <your-namespace>
```

### 4. Install the Chart

```bash
helm install <release-name> ./deployments/vision-matcher --namespace <your-namespace>
```

Replace `<release-name>` with your desired release name.

## Uninstalling the Chart

```bash
helm uninstall <release-name> --namespace <your-namespace>
```

For more information, refer to the [Helm documentation](https://helm.sh/docs/).

## Notes

- Ensure that any pre-existing resources in the namespace do not conflict with those defined in this chart.
