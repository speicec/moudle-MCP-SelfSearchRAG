/**
 * @spec resources.md
 * @layer 6
 * @description MCP Resources接口定义
 */

// Resource定义
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

// Resource内容
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text: string;
}

// Resource模板参数
export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType?: string;
}

// Resource提供者接口
export interface IResourceProvider {
  getUri(): string;
  getName(): string;
  read(params?: Record<string, string>): Promise<ResourceContent>;
  subscribe?(callback: (content: ResourceContent) => void): () => void;
}