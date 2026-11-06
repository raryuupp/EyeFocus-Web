👁️ EyeFocus-Assist - 纯软件级视线追踪辅助阅读系统
https://img.shields.io/badge/Status-MVP%20Complete-brightgreen
https://img.shields.io/badge/Tech-WebRTC%20%7C%20MediaPipe%20%7C%20JavaScript-blue
https://img.shields.io/badge/Algorithm-Head--Eye%20Fusion-orange

📖 项目简介
EyeFocus-Assist 是一款基于 Web 端的轻量级辅助阅读工具。针对长时间在电脑前阅读或输入人群容易产生的“阅读串行”和“视觉疲劳”痛点，本项目利用普通网络摄像头（无需任何昂贵的专业眼动仪硬件），通过纯前端技术实现了实时的视线追踪与行级阅读高亮辅助。

✨ 核心特性 (Features)
零硬件依赖：仅需一台带有普通摄像头的电脑。

多模态头眼融合：结合面部特征点（鼻尖）与虹膜特征，实现“头部大范围定位 + 眼球小范围微调”的丝滑交互。

动态非线性权重：独创的区域权重算法，中心区域增强头部稳定性，边缘区域降低头部灵敏度，完美解决纯眼球追踪的噪声问题。

行级防闪烁吸附：引入迟滞效应（Dwell Time），视线在目标行停留超 250ms 才会触发高亮跳转，杜绝光标乱跳。

免标定持久化：基于 LocalStorage 缓存标定数据，一次标定，长久使用。

🧠 核心架构与算法 (Architecture & Algorithms)
本项目经历了从“绝对坐标映射”到“相对比例融合”的多次迭代，最终采用了以下核心算法架构：

特征提取层：利用 Google MediaPipe Face Mesh 提取 468 个面部特征点，精准定位双眼虹膜中心（468/473）与鼻尖（1）。

四点极值标定：通过注视屏幕四角，采集用户个性化极限数据，并加入 10% 的弹性余量防止边缘卡死。

动态加权融合 (Dynamic Weighting)：根据当前视线偏离屏幕中心的距离，实时计算头部（Head_Weight）与眼球（Eye_Weight）的权重比例，实现非线性平滑过渡。

指数移动平均防抖 (EMA)：手写阻尼平滑算法 Current = Current * 0.9 + Target * 0.1，彻底消除摄像头噪点带来的“帕金森抖动”。

行级吸附逻辑 (Line Snapping)：结合 DOM 元素边界（BoundingClientRect），计算视线 Y 轴坐标与文本行的最近距离，实现像素级的高亮贴合。

🛠️ 快速开始 (Quick Start)
本项目无需复杂构建，完全基于原生 Web 技术。

克隆本项目到本地。

使用 VS Code 打开项目文件夹。

安装并启动 Live Server 插件。

在浏览器中打开弹出的本地地址（确保允许摄像头权限）。

保持头部微动、眼球注视，依次完成屏幕四个角的红点标定，即可开始体验。

🚀 未来路线 (Roadmap)
□ Sprint 3: 接入大语言模型 (LLM)，实现“视线停留超 5 秒自动生成段落解释”的 AI 赋能。
□ Sprint 4: 实现局域网跨端联动（PC 端打字，手机端利用前置摄像头追踪并高亮）。
□ Sprint 5: 移植至 Unity / OpenXR，探索 AR/MR 眼镜下的空间阅读辅助。
👨‍💻 开发者 
Author：WeikangDev
GitHub: @raryuupp

专注于计算机视觉、人机交互与大模型应用落地。

Made with ❤️ and DeepSeek.