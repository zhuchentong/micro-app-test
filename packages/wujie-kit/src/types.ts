/** 主应用注册表条目 */
export interface MicroApp {
  key: string;
  name: string;
  domain: string;
  color: string;
}

/** 子应用自身标识配置 */
export interface SubAppConfig {
  name: string;
  accent: string;
}

/** 主应用经 startApp props 注入的数据 */
export interface HostProps {
  user: { id: string; name: string };
  theme: string;
}
