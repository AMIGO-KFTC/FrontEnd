// 스마트보안카드 인증번호(6자리). 서버 검증 API 가 아직 없어, 회원가입·비밀번호 재설정 화면이 모두 이 고정 번호로 확인한다(개발·시연용).
// 실제 스마트보안카드 연동이 생기면 이 파일의 확인 부분을 API 호출로 바꾼다.
export const SECURITY_CARD_CODE = "111111";

export const SECURITY_CARD_LENGTH = SECURITY_CARD_CODE.length;

// 입력값을 검사하고 안내 문구를 돌려준다(통과하면 null). 기본은 6자리 숫자면 아무 번호나 통과한다(시연용, 회원가입·비밀번호 재설정 모두). anyCode=false 면 고정 번호만 통과.
export function checkSecurityCard(input: string, anyCode = true): string | null {
  if (!new RegExp(`^\\d{${SECURITY_CARD_LENGTH}}$`).test(input)) return `${SECURITY_CARD_LENGTH}자리 인증번호를 입력해 주세요.`;
  if (!anyCode && input !== SECURITY_CARD_CODE) return "인증번호가 일치하지 않아요. 다시 확인해 주세요.";
  return null;
}
