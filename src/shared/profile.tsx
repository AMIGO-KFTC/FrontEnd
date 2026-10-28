// 로그인한 사용자 프로필. 사이드바·단계 화면의 사용자 메뉴가 읽는다.
// 2단계에서 BackEnd 의 /api/auth/me 응답(AuthUser)으로 채운다. 사진은 서버에 올리지 않고 이 브라우저(localStorage, 로그인 아이디별)에만 둔다.
import { createContext, useContext, useState, type ReactNode } from "react";
import type { AuthUser } from "./types";

// role 은 직책(직위) 문자열이고, isAdmin 은 서버의 관리자 권한(users.is_admin, 팀장)이다.
// loginId 는 로그인 아이디, employeeId 는 사번(서로 다른 값이다).
export type Profile = { name: string; loginId: string; employeeId: string; division: string; team: string; role: string; photo: string; isAdmin: boolean };

// 직급(낮은 순). 프로필 수정 창의 직책 선택 목록에 쓴다.
export const RANKS = ["사원", "계장", "대리", "과장", "차장", "부부장", "팀장", "부장", "본부장", "전무", "원장"];

export const EMPTY_PROFILE: Profile = { name: "", loginId: "", employeeId: "", division: "", team: "", role: "", photo: "", isAdmin: false };

// 프로필 사진(data URL)을 로그인 아이디별로 브라우저에 저장·복원한다. 저장 공간이 막혀 있어도 화면은 그대로 쓸 수 있게 실패는 무시한다.
const photoKey = (loginId: string) => `amigo.profile-photo.${loginId}`;
export function loadProfilePhoto(loginId: string): string {
  try {
    return window.localStorage.getItem(photoKey(loginId)) ?? "";
  } catch {
    return "";
  }
}
export function saveProfilePhoto(loginId: string, photo: string): void {
  try {
    if (photo) window.localStorage.setItem(photoKey(loginId), photo);
    else window.localStorage.removeItem(photoKey(loginId));
  } catch {
    /* 저장하지 못해도 이번 접속에서는 사진이 보인다 */
  }
}

// 아바타 원 안에 넣을 내용: 사진이 있으면 사진, 없으면 이름 첫 글자. 사이드바뿐 아니라 모든 화면의 아바타가 같이 쓴다.
export function ProfilePhoto({ profile }: { profile: Pick<Profile, "name" | "photo"> }) {
  return profile.photo ? <img src={profile.photo} alt="" /> : <>{profile.name.slice(0, 1)}</>;
}

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
    photo: loadProfilePhoto(user.login_id),
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
