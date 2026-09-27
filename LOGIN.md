현재 할일 앱에 Github OAuth로그인을 추가해줘

##완료조건##
[ ] 깃허브 OAuth 설정가이드 또는 .env.example제공
[ ] /auth/github , /auth/github/callback라우트 동작
[ ] 로그인후 깃허브 username , avatar_url을 DB에 저장 
[ ] 로그인하지 않는 사용자는 할일목록에 접근불가(401 또는 리다이렉트) 
[ ] 로그인한 사용자는 본인의 할일만 조회/수정/삭제 가능
[ ] 로그아웃시 세션완전삭제
[ ] 기존 할일 데이터 스키마에 user_id 컬럼추가 및 마이그레이션

##하지 말아야 할 것 
- 기존할일 CRUD 로직변경금지 
- 하드코딩된 CLIENT_SECRET 금지
- 미완성상태로 "완료" 라고 보고하지 말 것 
