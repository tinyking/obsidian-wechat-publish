/* eslint-disable obsidianmd/ui/sentence-case */
import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import MarkdownIt from 'markdown-it';
import juice from 'juice';

// ==========================================
// 默认样式：紫色商务风 (仿 MDNice)
// ==========================================
const DEFAULT_CSS = `
  /* 全局容器设置 */
  .wechat-content { 
    font-family: Optima, PingFangSC-regular, "PingFang SC", "Microsoft YaHei", sans-serif; 
    font-size: 16px; 
    color: rgb(0, 0, 0); 
    line-height: 1.6em; 
    text-align: left; 
    padding: 0 10px;
  }
  
  /* H1 标题 */
  h1 { 
    font-size: 24px; 
    font-weight: bold; 
    color: rgb(119, 48, 152); 
    text-align: center; 
    margin-bottom: 30px; 
  }

  /* H2 标题 (核心复刻：居中、紫色、下划线) */
  h2 { 
    display: block;
    width: 85%;
    margin: 40px auto 20px auto; 
    padding-bottom: 10px;
    font-size: 22px; 
    font-weight: bold; 
    color: rgb(119, 48, 152); 
    text-align: center; 
    border-bottom: 1px solid rgb(119, 48, 152); 
  }

  /* H3 标题 */
  h3 { 
    font-size: 20px; 
    font-weight: bold; 
    color: rgb(119, 48, 152); 
    margin-top: 30px; 
    margin-bottom: 15px; 
    display: block;
  }
  
  /* 段落文字 */
  p { 
    text-align: justify;
    font-size: 17px;
    font-weight: 300;
    color: rgba(0,0,0,0.9);
    margin-bottom: 24px;
    line-height: 2.0;
  }
  
  /* 列表 */
  ul, ol { 
    margin: 10px 0 10px 20px;
    padding-left: 0;
  }
  li { 
    font-size: 17px; 
    color: rgb(90, 90, 90); 
    line-height: 1.8em; 
    margin-bottom: 5px; 
  }
  
  /* 引用块 (复刻：紫色左边框、浅紫背景) */
  blockquote { 
    margin: 20px 0; 
    padding: 15px 20px; 
    background-color: rgb(251, 249, 253); 
    border-left: 3px solid rgb(150, 84, 181); 
    border-right: 1px solid rgb(150, 84, 181); 
    color: rgb(90, 90, 90);
    font-size: 17px;
    border-radius: 4px;
  }

  /* 引用块中的段落 */
  blockquote p {
    margin: 0; 
  }
  
  /* 加粗文字：紫色、无下划线 */
  strong { 
    color: rgb(119, 48, 152); 
    font-weight: bold; 
  }
  
  /* 图片 */
  img { 
    display: block; 
    margin: 20px auto; 
    max-width: 100%; 
    height: auto; 
    border-radius: 4px; 
    box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
  }

  /* 代码块 */
  pre { 
    background: #f6f8fa; 
    padding: 15px; 
    border-radius: 5px; 
    overflow-x: auto; 
    font-size: 14px; 
    font-family: Consolas, monospace;
    line-height: 1.4;
  }
  code {
    background: #f0f0f0;
    padding: 2px 5px;
    border-radius: 3px;
    color: #d14;
    font-family: Consolas, monospace;
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