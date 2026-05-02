import { BaseTool } from './registry';
import { getLatestImage } from '../core/imageStore';
import { analyzeImage } from '../core/multimodalClient';

export class OcrTool extends BaseTool {
  name = 'ocr';
  description = '识别用户上传的图片中的文字和题目。当用户拍照或从相册选择图片后，调用此工具分析图片。对于几何图等复杂图形会直接解答。';
  parameters = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(_kwargs: Record<string, any>): Promise<string> {
    const imageBase64 = getLatestImage();
    if (!imageBase64) {
      return '当前没有可用的图片。请先让用户使用相机拍照或从相册选择图片。';
    }

    const result = await analyzeImage(imageBase64);

    if (result.isTakeover) {
      return `__TAKEOVER__${result.text}`;
    }
    return `用户上传的图片中的题目：${result.text}`;
  }
}
