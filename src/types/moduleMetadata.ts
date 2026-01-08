export interface ModuleMetadata {
  name: string | null;
  category: string | null;
  imports: string[];
  hasMetadata: boolean;
}
