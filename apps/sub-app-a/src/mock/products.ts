/** 产品示例数据(演示用;真实场景由子应用 API 提供) */
export interface Product {
  id: string;
  name: string;
  price: number;
  desc: string;
}

export const products: Product[] = [
  { id: "101", name: "智能手表 Pro", price: 1299, desc: "心率监测 + 长续航,支持 eSIM 通话" },
  { id: "102", name: "智能手表 Air", price: 799, desc: "轻量设计,14 天续航,全天候健康追踪" },
  { id: "103", name: "运动手环 5", price: 299, desc: "120 种运动模式,50 米防水" },
  { id: "104", name: "智能耳机 X1", price: 899, desc: "主动降噪,空间音频,无线充电" },
  { id: "105", name: "智能音箱 Mini", price: 199, desc: "全屋互联中枢,语音助手内置" },
  { id: "106", name: "智能灯带 Vision", price: 159, desc: "1600 万色,场景联动,音乐律动" },
];

export function findProduct(id: string): Product | undefined {
  return products.find((item) => item.id === id);
}
