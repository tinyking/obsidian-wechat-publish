/* eslint-disable obsidianmd/ui/sentence-case */
import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import MarkdownIt from 'markdown-it';
import juice from 'juice';

// ==========================================
// 默认样式：仿微信公众号爆款文章风格
// ==========================================
const DEFAULT_CSS = `
  /* 全局容器设置 */
  .wechat-content { 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; 
    font-size: 16px; 
    color: #333; 
    line-height: 1.75; 
    text-align: left; 
    padding: 20px 15px;
    max-width: 100%;
  }
  
  /* H1 标题 - 黑色大号左对齐 */
  h1 { 
    font-size: 28px; 
    font-weight: 700; 
    color: #1a1a1a; 
    text-align: left; 
    margin: 0 0 16px 0;
    line-height: 1.4;
  }

  /* H2 标题 - 橙色带下划线 */
  h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e8913c;
    margin: 32px 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #e8913c;
    line-height: 1.4;
  }

  /* H3 标题 - 青色带下划线 */
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #2eaadc;
    margin: 24px 0 12px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid #2eaadc;
    line-height: 1.4;
  }
  
  /* 段落文字 */
  p { 
    text-align: justify;
    font-size: 16px;
    font-weight: 400;
    color: #333;
    margin: 0 0 20px 0;
    line-height: 1.9;
    text-indent: 0;
  }
  
  /* 引用块 - 橙色/金色副标题风格 */
  blockquote { 
    margin: 20px 0; 
    padding: 12px 16px; 
    background: linear-gradient(135deg, #fff8f0 0%, #fff 100%);
    border-left: 4px solid #e8913c;
    color: #e8913c;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.7;
  }

  /* 引用块中的段落 */
  blockquote p {
    margin: 0;
    color: #e8913c;
    font-weight: 500;
  }
  
  /* 加粗文字 - 紫色强调 */
  strong { 
    color: #8b5cf6; 
    font-weight: 600; 
  }
  
  /* 斜体 */
  em {
    font-style: italic;
    color: #666;
  }
  
  /* 链接 */
  a {
    color: #2eaadc;
    text-decoration: none;
    border-bottom: 1px solid #2eaadc;
  }
  
  /* 列表 */
  ul, ol { 
    margin: 16px 0;
    padding-left: 24px;
  }
  li { 
    font-size: 16px; 
    color: #333; 
    line-height: 1.9; 
    margin-bottom: 8px; 
  }
  
  /* 图片 */
  img { 
    display: block; 
    margin: 24px auto; 
    max-width: 100%; 
    height: auto; 
    border-radius: 8px;
  }

  /* 代码块 */
  pre { 
    background: #f8f9fa; 
    padding: 16px; 
    border-radius: 6px; 
    overflow-x: auto; 
    font-size: 14px; 
    font-family: "SF Mono", Monaco, Consolas, monospace;
    line-height: 1.6;
    margin: 20px 0;
  }
  code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 14px;
    font-family: "SF Mono", Monaco, Consolas, monospace;
    color: #d73a49;
  }
  pre code {
    background: transparent;
    padding: 0;
  }
  
  /* 水平线 */
  hr {
    border: none;
    border-top: 1px solid #eee;
    margin: 32px 0;
  }
`;

interface WechatPluginSettings {
	customCSS: string;
}

const DEFAULT_SETTINGS: WechatPluginSettings = {
	customCSS: DEFAULT_CSS
}

export default class WechatCopyPlugin extends Plugin {
	settings: WechatPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'copy-to-wechat',
			name: 'Copy to WeChat',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const markdown = editor.getValue();
				const currentPath = view.file ? view.file.path : '';
				await this.processAndCopy(markdown, currentPath);
			}
		});

		this.addSettingTab(new WechatSettingTab(this.app, this));
	}

	async processAndCopy(markdown: string, currentPath: string) {
		new Notice('正在渲染“紫色商务风”并处理图片...');

		try {
			// 1. 预处理：将 Obsidian 的 Wiki Link ![[image.png]] 转换为标准 Markdown
			const normalizedMarkdown = this.convertWikiLinks(markdown);

			const md = new MarkdownIt({
				html: true,
				breaks: true,
				linkify: true
			});

			// 2. 渲染成 HTML
			const html = md.render(normalizedMarkdown);

			// 3. 核心步骤：处理图片转 Base64
			const htmlWithBase64 = await this.processImagesToBase64(html, currentPath);

			// 4. 拼接 CSS
			const fullHtml = `<div class="wechat-content"><style>${this.settings.customCSS}</style>${htmlWithBase64}</div>`;

			// 5. 内联样式 (Juice)
			const inlinedHtml = juice(fullHtml);

			// 6. 复制
			await this.copyToClipboard(inlinedHtml, markdown);

			new Notice('✅ 已复制！请直接粘贴到公众号。');
		} catch (error) {
			console.error(error);
			const msg = (error instanceof Error) ? error.message : String(error);
			new Notice('❌ 复制失败：' + msg);
		}
	}

	// 将 ![[image.png]] 转换为 ![](image.png)
	convertWikiLinks(markdown: string): string {
		const wikiImageRegex = /!\[\[([^\]]*?)\]\]/g;
		return markdown.replace(wikiImageRegex, (match: string, content: string) => {
			let fileName = content;
			let altText = '';

			// 处理管道符 | (用于改大小或别名)
			if (content.includes('|')) {
				const parts = content.split('|');
				fileName = parts[0] ?? "";
				altText = parts.slice(1).join('|');
			}

			// 去除首尾空格
			fileName = fileName.trim();

			// 关键点：URL 编码，处理文件名中的空格 "Image (1).png" -> "Image%20(1).png"
			const encodedPath = encodeURI(fileName);

			return `![${altText}](${encodedPath})`;
		});
	}

	// 核心逻辑：解析 HTML，查找 img 标签，将本地路径转为 Base64
	async processImagesToBase64(html: string, sourcePath: string): Promise<string> {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		const images = doc.getElementsByTagName('img');
		const promises: Promise<void>[] = [];

		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			if (!img) continue;

			const src = img.getAttribute('src');

			if (src) {
				// 跳过网络图片和已经是 Base64 的图片
				if (src.startsWith('http') || src.startsWith('data:')) {
					continue;
				}

				const task = async () => {
					try {
						// 解码路径 (因为我们在 convertWikiLinks 里编码过)
						const decodedSrc = decodeURIComponent(src);

						// 使用 Obsidian API 解析文件路径
						const file = this.app.metadataCache.getFirstLinkpathDest(decodedSrc, sourcePath);

						if (file && file instanceof TFile) {
							const base64 = await this.readImageToBase64(file);
							img.setAttribute('src', base64);
						} else {
							console.warn('未找到图片文件:', decodedSrc);
						}
					} catch (e) {
						console.error('图片转换失败:', src, e);
					}
				};
				promises.push(task());
			}
		}

		// 等待所有图片处理完成
		await Promise.all(promises);
		return doc.body.innerHTML;
	}

	async readImageToBase64(file: TFile): Promise<string> {
		const buffer = await this.app.vault.readBinary(file);
		const arr = new Uint8Array(buffer);

		// 简单的二进制转 Base64 字符串
		let binary = '';
		const len = arr.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(arr[i]!);
		}
		const base64 = window.btoa(binary);

		// 根据扩展名判断 mime type
		const ext = file.extension.toLowerCase();
		const mimeMap: Record<string, string> = {
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'gif': 'image/gif',
			'webp': 'image/webp',
			'svg': 'image/svg+xml'
		};
		const mime = mimeMap[ext] || 'image/jpeg';

		return `data:${mime};base64,${base64}`;
	}

	async copyToClipboard(html: string, plainText: string) {
		if (navigator.clipboard && navigator.clipboard.write) {
			const data = [new ClipboardItem({
				"text/html": new Blob([html], { type: "text/html" }),
				"text/plain": new Blob([plainText], { type: "text/plain" })
			})];

			await navigator.clipboard.write(data);
		} else {
			throw new Error("Clipboard API not supported");
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as WechatPluginSettings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class WechatSettingTab extends PluginSettingTab {
	plugin: WechatCopyPlugin;

	constructor(app: App, plugin: WechatCopyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('WeChat formatting')
			.setHeading();

		new Setting(containerEl)
			.setName('Reset style')
			.setDesc('Click to reset style to default "Purple Business" theme')
			.addButton(button => button
				.setButtonText('Reset')
				.onClick(async () => {
					this.plugin.settings.customCSS = DEFAULT_CSS;
					await this.plugin.saveSettings();
					this.display(); // 刷新界面
					new Notice('Style reset!');
				}));

		new Setting(containerEl)
			.setName('Custom CSS')
			.setDesc('Define the converted article style (CSS)')
			.addTextArea(text => {
				text.setPlaceholder('Enter CSS...')
					.setValue(this.plugin.settings.customCSS)
					.onChange(async (value) => {
						this.plugin.settings.customCSS = value;
						await this.plugin.saveSettings();
					});

				text.inputEl.rows = 20;
				text.inputEl.addClass('wechat-plugin-textarea');
			});
	}
}