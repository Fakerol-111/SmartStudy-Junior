export interface TestQuestion {
  id: string;
  subject: string;
  title: string;
  text: string;
}

export const TEST_QUESTIONS: TestQuestion[] = [
  // ── Math ──
  { id: 'm1', subject: 'math', title: '一元一次方程', text: '解方程：2x + 5 = 15，请给出详细的解题步骤。' },
  { id: 'm2', subject: 'math', title: '勾股定理', text: '一个直角三角形的两条直角边分别为 3cm 和 4cm，斜边长度为多少？请用勾股定理计算并说明过程。' },
  { id: 'm3', subject: 'math', title: '二次函数顶点', text: '已知二次函数 y = x² − 4x + 3，求该抛物线的顶点坐标和与 x 轴的交点坐标。' },
  { id: 'm4', subject: 'math', title: '因式分解解方程', text: '因式分解解方程：x² − 5x + 6 = 0，写出完整的解题过程。' },
  { id: 'm5', subject: 'math', title: '分数计算', text: '计算：1/2 + 1/3 + 1/4 = ? 请写出通分和计算过程。' },

  // ── Physics ──
  { id: 'p1', subject: 'physics', title: '牛顿第二定律', text: '一个质量为 2kg 的物体受到水平方向 6N 的拉力作用（摩擦力忽略不计），求物体的加速度。' },
  { id: 'p2', subject: 'physics', title: '光的折射', text: '光从空气（折射率≈1.0）斜射入水中（折射率≈1.33），入射角为 30°，请计算折射角的大小。（sin30°=0.5）' },
  { id: 'p3', subject: 'physics', title: '串联电路计算', text: '在串联电路中，R₁=10Ω，R₂=20Ω，电源电压为 6V，求电路中的电流和 R₂ 两端的电压。' },
  { id: 'p4', subject: 'physics', title: '密度计算', text: '一个物体的质量为 234g，体积为 30cm³，求该物体的密度，并判断它可能是哪种金属。' },

  // ── Chemistry ──
  { id: 'c1', subject: 'chemistry', title: '化学方程式配平', text: '请配平以下化学方程式：Fe + O₂ → Fe₃O₄，并写出配平步骤。' },
  { id: 'c2', subject: 'chemistry', title: '酸碱中和反应', text: '将 20mL 0.1mol/L 的 HCl 溶液与 30mL 0.1mol/L 的 NaOH 溶液混合，反应后溶液呈酸性、碱性还是中性？请说明理由。' },
  { id: 'c3', subject: 'chemistry', title: '相对分子质量计算', text: '计算 CaCO₃（碳酸钙）的相对分子质量，并求其中钙元素的质量分数。' },
  { id: 'c4', subject: 'chemistry', title: '化学方程式计算', text: '电解 36g 水（2H₂O → 2H₂↑ + O₂↑），能生成氢气和氧气各多少克？' },

  // ── English ──
  { id: 'e1', subject: 'english', title: '时态填空', text: '用所给词的适当形式填空：He ___ (go) to school by bus every day. 请说明为什么使用这个时态。' },
  { id: 'e2', subject: 'english', title: '被动语态转换', text: '将下列句子改为被动语态：「The students clean the classroom every day.」并说明被动语态的构成规则。' },
  { id: 'e3', subject: 'english', title: '完形填空讲解', text: 'I ___ (be) a student. My brother ___ (like) playing basketball after school. He ___ (play) with his friends every weekend. 请填入正确形式并讲解理由。' },

  // ── Chinese ──
  { id: 'ch1', subject: 'chinese', title: '古诗词赏析', text: '阅读李白的《静夜思》：床前明月光，疑是地上霜。举头望明月，低头思故乡。请分析诗中表达了诗人怎样的思想感情，诗中用了什么修辞手法？' },
  { id: 'ch2', subject: 'chinese', title: '作文提纲', text: '以"我最难忘的一件事"为题，帮我列一个作文提纲，要求包括开头、中间和结尾三部分，并给出每部分的写作要点。' },
  { id: 'ch3', subject: 'chinese', title: '文言文翻译', text: '将以下文言文翻译成现代汉语：「学而不思则罔，思而不学则殆。」并解释这句话的含义。' },

  // ── History ──
  { id: 'h1', subject: 'history', title: '秦始皇统一六国', text: '请简述秦始皇统一六国的历史意义，并列举他巩固统一的三个重要措施。' },
  { id: 'h2', subject: 'history', title: '丝绸之路', text: '请介绍古代丝绸之路的主要路线和作用，说明它对中国古代文化交流的意义。' },
  { id: 'h3', subject: 'history', title: '辛亥革命', text: '辛亥革命发生在哪一年？它的历史意义是什么？对中国近代社会产生了哪些影响？' },

  // ── Geography ──
  { id: 'g1', subject: 'geography', title: '南北方气候差异', text: '我国南方地区和北方地区在气候类型和特征上有什么主要差异？这些差异对农业生产和人们生活有什么影响？' },
  { id: 'g2', subject: 'geography', title: '地球自转与公转', text: '请解释地球自转和公转的区别，并说明它们分别产生了哪些自然现象。' },

  // ── Biology ──
  { id: 'b1', subject: 'biology', title: '光合作用', text: '请简述光合作用的过程，写出光合作用的化学方程式，并说明光合作用对生物圈的重要意义。' },
  { id: 'b2', subject: 'biology', title: '生态系统', text: '什么是食物链和食物网？请举例说明草原生态系统中的一条食物链，并分析如果其中的生产者大量减少会有什么影响。' },
  { id: 'b3', subject: 'biology', title: '细胞结构', text: '请比较植物细胞和动物细胞在结构上的异同点，并说明细胞膜、细胞核和线粒体的功能。' },

  // ── Politics ──
  { id: 'po1', subject: 'politics', title: '未成年人法律保护', text: '作为未成年人，当我们的合法权益受到侵害时，可以通过哪些途径寻求法律保护？请列举至少三种方式并简要说明。' },
  { id: 'po2', subject: 'politics', title: '公民基本权利', text: '我国宪法规定的公民基本权利包括哪些类别？请各举一个例子说明。' },
];
