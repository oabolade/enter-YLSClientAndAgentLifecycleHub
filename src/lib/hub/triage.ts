import { LANGUAGE_NAME_EN, LINE_NAME_EN } from "./labels";
import type {
  ChipId,
  Client,
  CoverageAction,
  HandoffReason,
  LangCode,
  LineId,
  Policy,
} from "./types";

/**
 * Simulated Bilingual Triage agent. Rule-based stand-in for the Covey agent:
 * swap `classify` and `buildSummary` for the live agent call when it is ready.
 */

export type Triage =
  | {
      tier: 1;
      intent: "docs" | "download" | "contact" | "payment" | "status" | "fallback";
      line: LineId | null;
      addDriver: boolean;
      wantsCoi: boolean;
    }
  | { tier: 2; reason: HandoffReason; line: LineId | null; action: CoverageAction | null };

const any = (text: string, patterns: RegExp[]) => patterns.some((p) => p.test(text));

const LINE_PATTERNS: [LineId, RegExp][] = [
  ["commercial", /(commercial|business|company|商业|商業|生意|公司|doanh nghiệp|kinh doanh|thương mại|negosyo|komersyal)/],
  ["medicare", /(medicare|medical|health|医疗|醫療|红蓝卡|紅藍卡|y tế|sức khỏe|kalusugan|medikal)/],
  ["life", /(life insurance|\blife\b|人寿|人壽|nhân thọ)/],
  ["home", /(\bhome|house|renter|property|房屋|房子|屋|bảo hiểm nhà|\bnhà\b|bahay)/],
  ["auto", /(\bauto|\bcar\b|driver|vehicle|汽车|汽車|车|車|司机|司機|驾驶|駕駛|\bxe\b|tài xế|kotse|sasakyan)/],
];

const CANCEL = [/\b(cancel|terminate)/, /(取消|退保|终止|終止)/, /(hủy|huỷ)/, /(kanselahin|ikansela|i-cancel)/];
const BIND = [/\bbind\b/, /(立即承保|立即生效|即刻生效)/, /(kích hoạt bảo hiểm ngay)/];
const MODIFY = [
  /(change|modify|update|increase|raise|lower|reduce|remove).{0,40}(coverage|policy|limit|deductible)/,
  /(更改|修改|变更|變更|改|增加|提高|降低|减少|減少).{0,12}(保额|保額|承保|保障|保单|保單|保险|保險|自付额|自付額)/,
  /(thay đổi|sửa|điều chỉnh|tăng|giảm).{0,30}(bảo hiểm|hợp đồng|mức)/,
  /(baguhin|palitan|dagdagan|bawasan).{0,30}(coverage|saklaw|polisiya|insurance)/,
];
const COMPLEX = [
  /(underwriting|dispute|denied|denial|rejected claim|lawsuit)/,
  /(纠纷|糾紛|拒赔|拒賠|核保|争议|爭議)/,
  /(tranh chấp|từ chối bồi thường|thẩm định)/,
  /(tinanggihan|hindi pagkakasundo)/,
];
const MEDICARE = /(medicare|advantage|medigap|联邦医疗|聯邦醫療|红蓝卡|紅藍卡)/;
const COMPARE = [
  /(compare|comparison|which plan|best plan|better plan|recommend|should i (switch|choose|pick))/,
  /(比较|比較|哪个|哪個|邊個|推荐|推薦|更好|更適合|更适合)/,
  /(so sánh|nào tốt|chương trình nào|nên chọn)/,
  /(ikumpara|paghambing|alin ang|pinakamaganda|mas maganda)/,
];
const HUMAN = [
  /(human|real person|speak (to|with)|talk (to|with)|call me|call back|callback|representative|an agent)/,
  /(人工|真人|经纪|經紀|回电|回電|打电话给我|打電話畀我|搵人|找人)/,
  /(nhân viên|người thật|gọi lại|nói chuyện với|đại lý)/,
  /(totoong tao|ahente|tawagan|makausap|kausapin)/,
];
const FRUSTRATED = [
  /(frustrat|angry|upset|ridiculous|terrible|unacceptable|worst|fed up|useless|complain)/,
  /(生气|生氣|不满|不滿|投诉|投訴|太差|离谱|離譜|失望|好嬲)/,
  /(bực|tức giận|thất vọng|quá tệ|khiếu nại)/,
  /(galit|naiinis|nakakainis|dismayado|reklamo)/,
];
const DOWNLOAD = [
  /(download|id card|\bcoi\b|certificate|proof of insurance)/,
  /(下载|下載|保险卡|保險卡|保险证明|保險證明)/,
  /(tải|thẻ bảo hiểm|chứng nhận)/,
  /(i-download|sertipiko|katibayan)/,
];
const COI = /(\bcoi\b|certificate|保险证明|保險證明|chứng nhận|sertipiko)/;
const DOCS = [
  /(document|paperwork|what do i need|need to (provide|bring|upload)|checklist|requirement)/,
  /(文件|资料|資料|材料|需要什么|需要什麼|要咩)/,
  /(giấy tờ|tài liệu|hồ sơ cần|cần những gì)/,
  /(dokumento|papeles)/,
];
const ADD_DRIVER = /(add.{0,20}driver|添加驾驶|加司機|加司机|thêm tài xế|magdagdag ng driver)/;
const STATUS = [
  /(status|progress|where is my|my (submission|application|request))/,
  /(进度|進度|状态|狀態)/,
  /(tình trạng|trạng thái|tiến độ)/,
  /(kalagayan|kulang pa)/,
];
const PAYMENT = [
  /(\bpay|payment|\bbill|autopay)/,
  /(付款|缴费|繳費|支付|账单|賬單|帳單|交費)/,
  /(thanh toán|đóng phí|hóa đơn)/,
  /(bayad|magbayad|bayaran)/,
];
const CONTACT = [
  /(office hours|opening hours|\bhours\b|address|location|phone number|contact|website)/,
  /(营业时间|營業時間|地址|电话|電話|联系|聯絡|联络)/,
  /(giờ làm việc|địa chỉ|số điện thoại|liên hệ)/,
  /(oras ng opisina|opisina|numero ng telepono|kontak)/,
];

export function detectLine(text: string): LineId | null {
  const lowered = text.toLowerCase();
  return LINE_PATTERNS.find(([, pattern]) => pattern.test(lowered))?.[0] ?? null;
}

export function classify(message: string): Triage {
  const text = message.toLowerCase();
  const line = detectLine(text);
  const tier2 = (reason: HandoffReason, action: CoverageAction | null = null): Triage => ({
    tier: 2,
    reason,
    line,
    action,
  });
  const tier1 = (intent: Extract<Triage, { tier: 1 }>["intent"]): Triage => ({
    tier: 1,
    intent,
    line,
    addDriver: ADD_DRIVER.test(text),
    wantsCoi: COI.test(text),
  });

  // Tier 2 guardrails run first: anything touching live coverage goes to a person.
  if (any(text, CANCEL)) return tier2("immediate_coverage_change", "cancel");
  if (any(text, BIND)) return tier2("immediate_coverage_change", "bind");
  if (any(text, MODIFY)) return tier2("immediate_coverage_change", "change");
  if (any(text, COMPLEX)) return tier2("commercial_complex");
  if (MEDICARE.test(text) && any(text, COMPARE)) return tier2("medicare_comparison");
  if (any(text, FRUSTRATED)) return tier2("frustrated");
  if (any(text, HUMAN)) return tier2("human_request");

  if (any(text, DOWNLOAD)) return tier1("download");
  if (ADD_DRIVER.test(text) || any(text, DOCS)) return tier1("docs");
  if (any(text, STATUS)) return tier1("status");
  if (any(text, PAYMENT)) return tier1("payment");
  if (any(text, CONTACT)) return tier1("contact");
  return tier1("fallback");
}

export function classifyChip(chip: ChipId): Triage {
  switch (chip) {
    case "addDriver":
      return { tier: 1, intent: "docs", line: "auto", addDriver: true, wantsCoi: false };
    case "downloadCoi":
      return { tier: 1, intent: "download", line: null, addDriver: false, wantsCoi: true };
    case "status":
      return { tier: 1, intent: "status", line: null, addDriver: false, wantsCoi: false };
    case "urgentCommercial":
      return {
        tier: 2,
        reason: "immediate_coverage_change",
        line: "commercial",
        action: "change",
      };
  }
}

export type SummaryInput = {
  name: string;
  language: LangCode;
  phone: string;
  reason: HandoffReason;
  line: LineId | null;
  action: CoverageAction | null;
  client: Client | null;
  topic?: string;
};

export function relatedPolicy(client: Client | null, line: LineId | null): Policy | null {
  if (!client) return null;
  if (line) return client.policies.find((policy) => policy.line === line) ?? null;
  return client.policies.length === 1 ? client.policies[0] : null;
}

/** Structured English brief for the licensed agent, whatever language the client used. */
export function buildSummary(input: SummaryInput): string {
  const { name, reason, line, action, client } = input;
  const policy = relatedPolicy(client, line);
  const lineName = line ? LINE_NAME_EN[line] : policy ? LINE_NAME_EN[policy.line] : "their";
  const onPolicy = policy ? ` on policy ${policy.policyNumber} (${policy.carrier})` : "";
  let body: string;
  switch (reason) {
    case "immediate_coverage_change":
      body = `${name} is asking to ${action ?? "change"} ${lineName} coverage effective immediately${onPolicy}. The AI concierge made no coverage changes and gave no binding advice.`;
      break;
    case "commercial_complex":
      body = `${name} raised a complex underwriting or claims dispute matter${onPolicy} that needs a licensed agent.`;
      break;
    case "medicare_comparison":
      body = `${name} is asking for a Medicare plan comparison or recommendation${onPolicy}. This requires licensed producer advice; the AI concierge gave none.`;
      break;
    case "frustrated":
      body = `${name} expressed frustration in the chat and should be contacted by an agent promptly.`;
      break;
    case "human_request":
      body = `${name} asked to speak with a licensed agent${line ? ` about ${lineName} insurance` : ""}.`;
      break;
    case "unanswered":
      body = `${name} asked a question the AI concierge could not answer reliably and accepted a handoff.`;
      break;
    case "document_request":
      body = `${name} asked for a document (ID card or COI) that is not on file${onPolicy}. Please send it to the client.`;
      break;
    case "callback_request":
      body = `${name} requested a callback about: ${input.topic ?? "a coverage review"}.`;
      break;
  }
  return `${body} Preferred language: ${LANGUAGE_NAME_EN[input.language]}. Callback number: ${input.phone}.`;
}
