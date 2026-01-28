# Result

> Represents a computation result

```typescript
interface Result {
  value: number;
  error?: string;
}
```

The Result type is used to wrap computation results with optional error information.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| value | number | ✓ | The computed value |
| error | string | | Optional error message |
