import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import MarkdownIt from 'markdown-it';
import juice from 'juice';

// ==========================================
// 核心修改：这里替换成了你提供的【紫色商务风】CSS
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
    font-size: 15px; 
    color: rgb(90, 90, 90); 
    line-height: 1.8em; 
    letter-spacing: 0.02em; 
    margin: 10px 0; 
    text-align: justify; /* 两端对齐更整齐 */
  }
  
  /* 列表 */
  ul, ol { 
    margin: 10px 0 10px 20px;
    padding-left: 0;
  }
  li { 
    font-size: 15px; 
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
    border-right: 1px solid rgb(150, 84, 181); /* 还原你样式中的右边框 */
    color: rgb(90, 90, 90);
    font-size: 15px;
    border-radius: 4px;
  }
  blockquote p {
    margin: 0; /* 引用内部段落去间距 */
  }
  
  /* 加粗文字 (复刻：底部灰色粗线条) */
  strong { 
    color: rgb(0, 0, 0); 
    font-weight: bold; 
    border-bottom: 3px solid rgba(0, 0, 0, 0.4); 
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
			name: 'Copy to WeChat Public Account (一键复制到公众号)',
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
			let html = md.render(normalizedMarkdown);

			// 3. 处理图片 Base64
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

	// 处理 Obsidian 图片链接 ![[...]]
	convertWikiLinks(markdown: string): string {
		const wikiImageRegex = /!\[\[([^\]]*?)\]\]/g;
		return markdown.replace(wikiImageRegex, (match, content) => {
			let fileName = content;
			let altText = '';
			if (content.includes('|')) {
				const parts = content.split('|');
				fileName = parts[0];
				altText = parts.slice(1).join('|');
			}
			fileName = fileName.trim();
			// 必须编码，否则带空格的文件名会失效
			const encodedPath = encodeURI(fileName);
			return `![${altText}](${encodedPath})`;
		});
	}

	async processImagesToBase64(html: string, sourcePath: string): Promise<string> {
		const wrapper = document.createElement('div');
		wrapper.innerHTML = html;
		const images = wrapper.getElementsByTagName('img');
		const promises: Promise<void>[] = [];

		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			if (!img) continue;

			const src = img.getAttribute('src');
			if (src) {
				if (src.startsWith('http') || src.startsWith('data:')) continue;

				const task = async () => {
					try {
						const decodedSrc = decodeURIComponent(src);
						const file = this.app.metadataCache.getFirstLinkpathDest(decodedSrc, sourcePath);
						
						if (file && file instanceof TFile) {
							const base64 = await this.readImageToBase64(file);
							img.setAttribute('src', base64);
						} else {
							console.warn('未找到图片:', decodedSrc);
						}
					} catch (e) {
						console.error('图片转换失败:', src, e);
					}
				};
				promises.push(task());
			}
		}
		await Promise.all(promises);
		return wrapper.innerHTML;
	}

	async readImageToBase64(file: TFile): Promise<string> {
		const buffer = await this.app.vault.readBinary(file);
		const arr = new Uint8Array(buffer);
		let binary = '';
		const len = arr.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(arr[i]!);
		}
		const base64 = window.btoa(binary);
		
		const ext = file.extension.toLowerCase();
		const mimeMap: Record<string, string> = {
			'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
			'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml'
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
		// 如果用户之前修改过 CSS，加载旧的；否则加载新的紫色默认样式
		// 注意：如果你之前已经运行过插件，Obsidian 会记住你旧的 CSS
		// 为了强制生效，你可以去设置里点一下“重置”或者手动删掉 data.json，
        // 或者最简单的方法：在设置页手动把框里的 CSS 清空，然后重启插件，它会加载新的 DEFAULT
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', {text: '微信公众号格式设置'});

        // 添加一个重置按钮，方便用户切回默认的紫色主题
        new Setting(containerEl)
            .setName('重置样式')
            .setDesc('点击将样式重置为默认的“紫色商务风”')
            .addButton(button => button
                .setButtonText('重置为默认')
                .onClick(async () => {
                    this.plugin.settings.customCSS = DEFAULT_CSS;
                    await this.plugin.saveSettings();
                    this.display(); // 刷新界面
                    new Notice('样式已重置！');
                }));

		new Setting(containerEl)
			.setName('自定义 CSS')
			.setDesc('定义文章转换后的样式')
			.addTextArea(text => {
				text.setPlaceholder('输入 CSS...')
					.setValue(this.plugin.settings.customCSS)
					.onChange(async (value) => {
						this.plugin.settings.customCSS = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 20;
				text.inputEl.style.width = '100%';
				text.inputEl.style.fontFamily = 'monospace';
			});
	}
}