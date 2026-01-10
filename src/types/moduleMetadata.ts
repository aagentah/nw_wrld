export interface ModuleMetadata {
  id?: string;
  name: string | null;
  category: string | null;
  imports: string[];
  hasMetadata: boolean;
  type?: string;
  props?: any;
  methods?: {
    name: string;
    executeOnLoad: boolean;
    options: {
      name: string;
      defaultVal: any;
      type: string;
    }[];
  }[];
  instancesOnCurrentTrack?: number;
}
