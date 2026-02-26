# run

> Run a container from an image

**Kind:** command

```bash
mycli run [OPTIONS] IMAGE [COMMAND] [ARG...]
```

Creates and starts a new container from the specified image.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `--name` | string |  | Assign a name to the container |
| `--port` | string |  | Publish container port |
| `--detach` | boolean |  | Run container in background |

## Examples

### Run nginx

```bash
mycli run --name web --port 8080:80 --detach nginx:latest
```

**Tags:** `core`
