export type AdminMember = { id: number; name: string; team: string; division: string; role: string; authority: string; handovers: number; lastActive: string };

export const initialAdminMembers: AdminMember[] = [
  { id: 1, name: "김민준", team: "플랫폼팀", division: "프로덕트본부", role: "프로덕트 매니저", authority: "최고 관리자", handovers: 4, lastActive: "방금 전" },
  { id: 2, name: "박서연", team: "B2B사업팀", division: "사업본부", role: "사업개발 매니저", authority: "일반 구성원", handovers: 7, lastActive: "12분 전" },
  { id: 3, name: "이지윤", team: "CX운영팀", division: "고객경험본부", role: "CX 매니저", authority: "팀 관리자", handovers: 3, lastActive: "1시간 전" },
  { id: 4, name: "최도윤", team: "인프라팀", division: "기술본부", role: "DevOps 엔지니어", authority: "일반 구성원", handovers: 2, lastActive: "—" },
  { id: 5, name: "한예린", team: "서비스기획팀", division: "프로덕트본부", role: "서비스 기획자", authority: "일반 구성원", handovers: 5, lastActive: "어제" },
  { id: 6, name: "정우진", team: "디자인팀", division: "프로덕트본부", role: "프로덕트 디자이너", authority: "일반 구성원", handovers: 1, lastActive: "2일 전" },
];
