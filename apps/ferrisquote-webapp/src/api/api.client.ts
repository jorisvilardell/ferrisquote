export namespace Schemas {
  // <Schemas>
  export type FieldConfigDto =
    | { max_length: number; type: "text" }
    | { max: number; min: number; type: "number" }
    | { max: string; min: string; type: "date" }
    | { default: boolean; type: "boolean" }
    | { options: Array<string>; type: "select" };
  export type ApiResponse_FieldResponse = {
    data: { config: FieldConfigDto; description: string; id: string; key: string; label: string; rank: string };
    success: boolean;
  };
  export type FlowSummaryResponse = { description: string; id: string; name: string; step_count: number };
  export type ApiResponse_FlowListResponse = { data: { flows: Array<FlowSummaryResponse> }; success: boolean };
  export type FieldResponse = {
    config: FieldConfigDto;
    description: string;
    id: string;
    key: string;
    label: string;
    rank: string;
  };
  export type StepResponse = {
    description: string;
    fields: Array<FieldResponse>;
    id: string;
    rank: string;
    title: string;
  };
  export type ApiResponse_FlowResponse = {
    data: { description: string; id: string; name: string; steps: Array<StepResponse> };
    success: boolean;
  };
  export type ApiResponse_MessageResponse = { data: { message: string }; success: boolean };
  export type ApiResponse_StepResponse = {
    data: { description: string; fields: Array<FieldResponse>; id: string; rank: string; title: string };
    success: boolean;
  };
  export type CreateFieldRequest = { config: FieldConfigDto; key: string; label: string };
  export type CreateFlowRequest = { description?: (string | null) | undefined; name: string };
  export type CreateStepRequest = { description?: (string | null) | undefined; title: string };
  export type FlowListResponse = { flows: Array<FlowSummaryResponse> };
  export type FlowResponse = { description: string; id: string; name: string; steps: Array<StepResponse> };
  export type MessageResponse = { message: string };
  export type MoveFieldRequest = Partial<{
    after_id: string | null;
    before_id: string | null;
    target_step_id: string | null;
  }>;
  export type ReorderStepRequest = Partial<{ after_id: string | null; before_id: string | null }>;
  export type UpdateFieldConfigRequest = { config: FieldConfigDto; label: string };
  export type UpdateFlowMetadataRequest = { description?: (string | null) | undefined; name: string };

  // </Schemas>
}

export namespace Endpoints {
  // <Endpoints>

  export type get_List_flows = {
    method: "GET";
    path: "/api/v1/flows";
    requestFormat: "json";
    parameters: never;
    responses: { 200: Schemas.FlowListResponse };
  };
  export type post_Create_flow = {
    method: "POST";
    path: "/api/v1/flows";
    requestFormat: "json";
    parameters: {
      body: Schemas.CreateFlowRequest;
    };
    responses: { 201: Schemas.FlowResponse; 400: unknown };
  };
  export type put_Update_field_config = {
    method: "PUT";
    path: "/api/v1/flows/fields/{field_id}";
    requestFormat: "json";
    parameters: {
      path: { field_id: string };

      body: Schemas.UpdateFieldConfigRequest;
    };
    responses: { 200: Schemas.FieldResponse; 400: unknown; 404: unknown };
  };
  export type delete_Remove_field = {
    method: "DELETE";
    path: "/api/v1/flows/fields/{field_id}";
    requestFormat: "json";
    parameters: {
      path: { field_id: string };
    };
    responses: { 200: Schemas.MessageResponse; 404: unknown };
  };
  export type put_Move_field = {
    method: "PUT";
    path: "/api/v1/flows/fields/{field_id}/move";
    requestFormat: "json";
    parameters: {
      path: { field_id: string };

      body: Schemas.MoveFieldRequest;
    };
    responses: { 200: Schemas.FlowResponse; 404: unknown };
  };
  export type delete_Remove_step = {
    method: "DELETE";
    path: "/api/v1/flows/steps/{step_id}";
    requestFormat: "json";
    parameters: {
      path: { step_id: string };
    };
    responses: { 200: Schemas.MessageResponse; 404: unknown };
  };
  export type post_Add_field = {
    method: "POST";
    path: "/api/v1/flows/steps/{step_id}/fields";
    requestFormat: "json";
    parameters: {
      path: { step_id: string };

      body: Schemas.CreateFieldRequest;
    };
    responses: { 201: Schemas.FieldResponse; 400: unknown; 404: unknown };
  };
  export type put_Reorder_step = {
    method: "PUT";
    path: "/api/v1/flows/steps/{step_id}/reorder";
    requestFormat: "json";
    parameters: {
      path: { step_id: string };

      body: Schemas.ReorderStepRequest;
    };
    responses: { 200: Schemas.FlowResponse; 404: unknown };
  };
  export type get_Get_flow = {
    method: "GET";
    path: "/api/v1/flows/{flow_id}";
    requestFormat: "json";
    parameters: {
      path: { flow_id: string };
    };
    responses: { 200: Schemas.FlowResponse; 404: unknown };
  };
  export type put_Update_flow_metadata = {
    method: "PUT";
    path: "/api/v1/flows/{flow_id}";
    requestFormat: "json";
    parameters: {
      path: { flow_id: string };

      body: Schemas.UpdateFlowMetadataRequest;
    };
    responses: { 200: Schemas.FlowResponse; 400: unknown; 404: unknown };
  };
  export type delete_Delete_flow = {
    method: "DELETE";
    path: "/api/v1/flows/{flow_id}";
    requestFormat: "json";
    parameters: {
      path: { flow_id: string };
    };
    responses: { 200: Schemas.MessageResponse; 404: unknown };
  };
  export type post_Add_step = {
    method: "POST";
    path: "/api/v1/flows/{flow_id}/steps";
    requestFormat: "json";
    parameters: {
      path: { flow_id: string };

      body: Schemas.CreateStepRequest;
    };
    responses: { 201: Schemas.StepResponse; 400: unknown; 404: unknown };
  };

  // </Endpoints>
}

// <EndpointByMethod>
export type EndpointByMethod = {
  get: {
    "/api/v1/flows": Endpoints.get_List_flows;
    "/api/v1/flows/{flow_id}": Endpoints.get_Get_flow;
  };
  post: {
    "/api/v1/flows": Endpoints.post_Create_flow;
    "/api/v1/flows/steps/{step_id}/fields": Endpoints.post_Add_field;
    "/api/v1/flows/{flow_id}/steps": Endpoints.post_Add_step;
  };
  put: {
    "/api/v1/flows/fields/{field_id}": Endpoints.put_Update_field_config;
    "/api/v1/flows/fields/{field_id}/move": Endpoints.put_Move_field;
    "/api/v1/flows/steps/{step_id}/reorder": Endpoints.put_Reorder_step;
    "/api/v1/flows/{flow_id}": Endpoints.put_Update_flow_metadata;
  };
  delete: {
    "/api/v1/flows/fields/{field_id}": Endpoints.delete_Remove_field;
    "/api/v1/flows/steps/{step_id}": Endpoints.delete_Remove_step;
    "/api/v1/flows/{flow_id}": Endpoints.delete_Delete_flow;
  };
};

// </EndpointByMethod>

// <EndpointByMethod.Shorthands>
export type GetEndpoints = EndpointByMethod["get"];
export type PostEndpoints = EndpointByMethod["post"];
export type PutEndpoints = EndpointByMethod["put"];
export type DeleteEndpoints = EndpointByMethod["delete"];
// </EndpointByMethod.Shorthands>

// <ApiClientTypes>
export type EndpointParameters = {
  body?: unknown;
  query?: Record<string, unknown>;
  header?: Record<string, unknown>;
  path?: Record<string, unknown>;
};

export type MutationMethod = "post" | "put" | "patch" | "delete";
export type Method = "get" | "head" | "options" | MutationMethod;

type RequestFormat = "json" | "form-data" | "form-url" | "binary" | "text";

export type DefaultEndpoint = {
  parameters?: EndpointParameters | undefined;
  responses?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
};

export type Endpoint<TConfig extends DefaultEndpoint = DefaultEndpoint> = {
  operationId: string;
  method: Method;
  path: string;
  requestFormat: RequestFormat;
  parameters?: TConfig["parameters"];
  meta: {
    alias: string;
    hasParameters: boolean;
    areParametersRequired: boolean;
  };
  responses?: TConfig["responses"];
  responseHeaders?: TConfig["responseHeaders"];
};

export interface Fetcher {
  decodePathParams?: (path: string, pathParams: Record<string, string>) => string;
  encodeSearchParams?: (searchParams: Record<string, unknown> | undefined) => URLSearchParams;
  //
  fetch: (input: {
    method: Method;
    url: URL;
    urlSearchParams?: URLSearchParams | undefined;
    parameters?: EndpointParameters | undefined;
    path: string;
    overrides?: RequestInit;
    throwOnStatusError?: boolean;
  }) => Promise<Response>;
  parseResponseData?: (response: Response) => Promise<unknown>;
}

export const successStatusCodes = [
  200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307, 308,
] as const;
export type SuccessStatusCode = (typeof successStatusCodes)[number];

export const errorStatusCodes = [
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424,
  425, 426, 428, 429, 431, 451, 500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511,
] as const;
export type ErrorStatusCode = (typeof errorStatusCodes)[number];

// Taken from https://github.com/unjs/fetchdts/blob/ec4eaeab5d287116171fc1efd61f4a1ad34e4609/src/fetch.ts#L3
export interface TypedHeaders<TypedHeaderValues extends Record<string, string> | unknown>
  extends Omit<Headers, "append" | "delete" | "get" | "getSetCookie" | "has" | "set" | "forEach"> {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/append) */
  append: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
    value: Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string,
  ) => void;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/delete) */
  delete: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(name: Name) => void;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/get) */
  get: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
  ) => (Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string) | null;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/getSetCookie) */
  getSetCookie: () => string[];
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/has) */
  has: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(name: Name) => boolean;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/set) */
  set: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
    value: Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string,
  ) => void;
  forEach: (
    callbackfn: (
      value: TypedHeaderValues[keyof TypedHeaderValues] | (string & {}),
      key: Extract<keyof TypedHeaderValues, string> | (string & {}),
      parent: TypedHeaders<TypedHeaderValues>,
    ) => void,
    thisArg?: any,
  ) => void;
}

/** @see https://developer.mozilla.org/en-US/docs/Web/API/Response */
export interface TypedSuccessResponse<TSuccess, TStatusCode, THeaders>
  extends Omit<Response, "ok" | "status" | "json" | "headers"> {
  ok: true;
  status: TStatusCode;
  headers: never extends THeaders ? Headers : TypedHeaders<THeaders>;
  data: TSuccess;
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) */
  json: () => Promise<TSuccess>;
}

/** @see https://developer.mozilla.org/en-US/docs/Web/API/Response */
export interface TypedErrorResponse<TData, TStatusCode, THeaders>
  extends Omit<Response, "ok" | "status" | "json" | "headers"> {
  ok: false;
  status: TStatusCode;
  headers: never extends THeaders ? Headers : TypedHeaders<THeaders>;
  data: TData;
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) */
  json: () => Promise<TData>;
}

export type TypedApiResponse<TAllResponses extends Record<string | number, unknown> = {}, THeaders = {}> = {
  [K in keyof TAllResponses]: K extends string
    ? K extends `${infer TStatusCode extends number}`
      ? TStatusCode extends SuccessStatusCode
        ? TypedSuccessResponse<TAllResponses[K], TStatusCode, K extends keyof THeaders ? THeaders[K] : never>
        : TypedErrorResponse<TAllResponses[K], TStatusCode, K extends keyof THeaders ? THeaders[K] : never>
      : never
    : K extends number
      ? K extends SuccessStatusCode
        ? TypedSuccessResponse<TAllResponses[K], K, K extends keyof THeaders ? THeaders[K] : never>
        : TypedErrorResponse<TAllResponses[K], K, K extends keyof THeaders ? THeaders[K] : never>
      : never;
}[keyof TAllResponses];

export type SafeApiResponse<TEndpoint> = TEndpoint extends { responses: infer TResponses }
  ? TResponses extends Record<string, unknown>
    ? TypedApiResponse<TResponses, TEndpoint extends { responseHeaders: infer THeaders } ? THeaders : never>
    : never
  : never;

export type InferResponseByStatus<TEndpoint, TStatusCode> = Extract<
  SafeApiResponse<TEndpoint>,
  { status: TStatusCode }
>;

type RequiredKeys<T> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P;
}[keyof T];

type MaybeOptionalArg<T> = RequiredKeys<T> extends never ? [config?: T] : [config: T];
type NotNever<T> = [T] extends [never] ? false : true;

// </ApiClientTypes>

// <TypedStatusError>
export class TypedStatusError<TData = unknown> extends Error {
  response: TypedErrorResponse<TData, ErrorStatusCode, unknown>;
  status: number;
  constructor(response: TypedErrorResponse<TData, ErrorStatusCode, unknown>) {
    super(`HTTP ${response.status}: ${response.statusText}`);
    this.name = "TypedStatusError";
    this.response = response;
    this.status = response.status;
  }
}
// </TypedStatusError>

// <ApiClient>
export class ApiClient {
  baseUrl: string = "";
  successStatusCodes = successStatusCodes;
  errorStatusCodes = errorStatusCodes;

  constructor(public fetcher: Fetcher) {}

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
    return this;
  }

  /**
   * Replace path parameters in URL
   * Supports both OpenAPI format {param} and Express format :param
   */
  defaultDecodePathParams = (url: string, params: Record<string, string>): string => {
    return url
      .replace(/{(\w+)}/g, (_, key: string) => params[key] || `{${key}}`)
      .replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => params[key] || `:${key}`);
  };

  /** Uses URLSearchParams, skips null/undefined values */
  defaultEncodeSearchParams = (queryParams: Record<string, unknown> | undefined): URLSearchParams | undefined => {
    if (!queryParams) return;

    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value != null) {
        // Skip null/undefined values
        if (Array.isArray(value)) {
          value.forEach((val) => val != null && searchParams.append(key, String(val)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    return searchParams;
  };

  defaultParseResponseData = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.startsWith("text/")) {
      return await response.text();
    }

    if (contentType === "application/octet-stream") {
      return await response.arrayBuffer();
    }

    if (
      contentType.includes("application/json") ||
      (contentType.includes("application/") && contentType.includes("json")) ||
      contentType === "*/*"
    ) {
      try {
        return await response.json();
      } catch {
        return undefined;
      }
    }

    return;
  };

  // <ApiClient.get>
  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
    >
  ): Promise<Extract<InferResponseByStatus<TEndpoint, SuccessStatusCode>, { data: {} }>["data"]>;

  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  get<Path extends keyof GetEndpoints, _TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<any>
  ): Promise<any> {
    return this.request("get", path, ...params);
  }
  // </ApiClient.get>

  // <ApiClient.post>
  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
    >
  ): Promise<Extract<InferResponseByStatus<TEndpoint, SuccessStatusCode>, { data: {} }>["data"]>;

  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  post<Path extends keyof PostEndpoints, _TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<any>
  ): Promise<any> {
    return this.request("post", path, ...params);
  }
  // </ApiClient.post>

  // <ApiClient.put>
  put<Path extends keyof PutEndpoints, TEndpoint extends PutEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
    >
  ): Promise<Extract<InferResponseByStatus<TEndpoint, SuccessStatusCode>, { data: {} }>["data"]>;

  put<Path extends keyof PutEndpoints, TEndpoint extends PutEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  put<Path extends keyof PutEndpoints, _TEndpoint extends PutEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<any>
  ): Promise<any> {
    return this.request("put", path, ...params);
  }
  // </ApiClient.put>

  // <ApiClient.delete>
  delete<Path extends keyof DeleteEndpoints, TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
    >
  ): Promise<Extract<InferResponseByStatus<TEndpoint, SuccessStatusCode>, { data: {} }>["data"]>;

  delete<Path extends keyof DeleteEndpoints, TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  delete<Path extends keyof DeleteEndpoints, _TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<any>
  ): Promise<any> {
    return this.request("delete", path, ...params);
  }
  // </ApiClient.delete>

  // <ApiClient.request>
  /**
   * Generic request method with full type-safety for any endpoint
   */
  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(
    method: TMethod,
    path: TPath,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: false; throwOnStatusError?: boolean }
    >
  ): Promise<Extract<InferResponseByStatus<TEndpoint, SuccessStatusCode>, { data: {} }>["data"]>;

  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(
    method: TMethod,
    path: TPath,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<UParams> extends true
          ? UParams & { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
          : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
        : { overrides?: RequestInit; withResponse?: true; throwOnStatusError?: boolean }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(method: TMethod, path: TPath, ...params: MaybeOptionalArg<any>): Promise<any> {
    const requestParams = params[0];
    const withResponse = requestParams?.withResponse;
    const {
      withResponse: _,
      throwOnStatusError = withResponse ? false : true,
      overrides,
      ...fetchParams
    } = requestParams || {};

    const parametersToSend: EndpointParameters = {};
    if (requestParams?.body !== undefined) (parametersToSend as any).body = requestParams.body;
    if (requestParams?.query !== undefined) (parametersToSend as any).query = requestParams.query;
    if (requestParams?.header !== undefined) (parametersToSend as any).header = requestParams.header;
    if (requestParams?.path !== undefined) (parametersToSend as any).path = requestParams.path;

    const resolvedPath = (this.fetcher.decodePathParams ?? this.defaultDecodePathParams)(
      this.baseUrl + (path as string),
      (parametersToSend.path ?? {}) as Record<string, string>,
    );
    const url = new URL(resolvedPath);
    const urlSearchParams = (this.fetcher.encodeSearchParams ?? this.defaultEncodeSearchParams)(parametersToSend.query);

    const promise = this.fetcher
      .fetch({
        method: method,
        path: path as string,
        url,
        urlSearchParams,
        parameters: Object.keys(fetchParams).length ? fetchParams : undefined,
        overrides,
        throwOnStatusError,
      })
      .then(async (response) => {
        const data = await (this.fetcher.parseResponseData ?? this.defaultParseResponseData)(response);
        const typedResponse = Object.assign(response, {
          data: data,
          json: () => Promise.resolve(data),
        }) as SafeApiResponse<TEndpoint>;

        if (throwOnStatusError && errorStatusCodes.includes(response.status as never)) {
          throw new TypedStatusError(typedResponse as never);
        }

        return withResponse ? typedResponse : data;
      });

    return promise as Extract<InferResponseByStatus<TEndpoint, SuccessStatusCode>, { data: {} }>["data"];
  }
  // </ApiClient.request>
}

export function createApiClient(fetcher: Fetcher, baseUrl?: string) {
  return new ApiClient(fetcher).setBaseUrl(baseUrl ?? "");
}

/**
 Example usage:
 const api = createApiClient((method, url, params) =>
   fetch(url, { method, body: JSON.stringify(params) }).then((res) => res.json()),
 );
 api.get("/users").then((users) => console.log(users));
 api.post("/users", { body: { name: "John" } }).then((user) => console.log(user));
 api.put("/users/:id", { path: { id: 1 }, body: { name: "John" } }).then((user) => console.log(user));

 // With error handling
 const result = await api.get("/users/{id}", { path: { id: "123" }, withResponse: true });
 if (result.ok) {
   // Access data directly
   const user = result.data;
   console.log(user);

   // Or use the json() method for compatibility
   const userFromJson = await result.json();
   console.log(userFromJson);
 } else {
   const error = result.data;
   console.error(`Error ${result.status}:`, error);
 }
*/

// </ApiClient>
