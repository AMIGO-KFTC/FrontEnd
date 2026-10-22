// 로그인한 사용자 프로필. 사이드바·단계 화면의 사용자 메뉴가 읽는다.
// 2단계에서 BackEnd 의 /api/auth/me 응답(AuthUser)으로 채운다. 사진은 브라우저에서만 쓴다.
import { createContext, useContext, useState, type ReactNode } from "react";
import type { AuthUser } from "./types";

// role 은 직책(직위) 문자열이고, isAdmin 은 서버의 관리자 권한(users.is_admin, 팀장)이다.
// loginId 는 로그인 아이디, employeeId 는 사번(서로 다른 값이다).
export type Profile = { name: string; loginId: string; employeeId: string; division: string; team: string; role: string; photo: string; isAdmin: boolean };

export const EMPTY_PROFILE: Profile = { name: "", loginId: "", employeeId: "", division: "", team: "", role: "", photo: "", isAdmin: false };

// AuthUser → Profile. 서버의 department 를 본부(division)로, employee_no 를 사번으로 쓴다.
export function profileFromUser(user: AuthUser): Profile {
  return {
    name: user.profile?.name || user.name,
    loginId: user.login_id,
    employeeId: user.employee_no ?? "",
    isAdmin: user.is_admin === true,
    division: user.profile?.department ?? "",
    team: user.profile?.team ?? "",
    role: user.profile?.position ?? "",
    photo: "",
  };
}

type ProfileValue = { profile: Profile; setProfile: (profile: Profile) => void };

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ initial = EMPTY_PROFILE, children }: { initial?: Profile; children: ReactNode }) {
  const [profile, setProfile] = useState(initial);
  return <ProfileContext.Provider value={{ profile, setProfile }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile 은 ProfileProvider 안에서만 쓸 수 있습니다.");
  return [value.profile, value.setProfile] as const;
}
