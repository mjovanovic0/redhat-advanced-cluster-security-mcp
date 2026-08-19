export interface ParameterSpec {
  name: string;
  description: string;
  required: string;
  default: string;
  pattern: string;
}

export interface BodyParameterSpec {
  name: string;
  type_ref?: string;
  description: string;
  required: string;
  default?: string;
  pattern?: string;
}

export interface ResponseSpec {
  code: string;
  message: string;
  datatype: string;
  datatype_ref?: string;
}

export interface EndpointSpec {
  name: string;
  method: string;
  path: string;
  description?: string;
  query_parameters?: ParameterSpec[];
  path_parameters?: ParameterSpec[];
  body_parameter?: BodyParameterSpec[];
  return_type: string;
  return_type_ref?: string;
  content_type: string;
  responses: ResponseSpec[];
}

export interface ServiceSpec {
  chapter: number;
  service: string;
  endpoint_count: number;
  endpoints: EndpointSpec[];
}

export interface ServiceIndexEntry {
  chapter: number;
  title: string;
  file: string;
  endpoint_count?: number;
  model_count?: number;
}

export interface ModelField {
  name: string;
  type?: string;
  type_ref?: string;
  format?: string;
  description?: string;
  required?: boolean;
  nullable?: boolean;
}

export interface EnumValue {
  "enum values": string;
}

export interface ModelSpec {
  name: string;
  fields?: ModelField[];
  raw?: EnumValue[];
  enum_values?: string[];
}

export interface ServiceIndex {
  product: string;
  version: string;
  source: string;
  service_count: number;
  services: ServiceIndexEntry[];
}
