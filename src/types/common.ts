/** Many contract payloads are typed as free-form objects in the API reference. */
export type Rec = Record<string, unknown>;

export interface Envelope<T = unknown> {
  success: boolean;
  statusCode?: number;
  message?: string;
  data: T;
  meta?: Rec;
}
