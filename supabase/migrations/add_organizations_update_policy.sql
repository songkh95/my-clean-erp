-- organizations 테이블에 UPDATE 정책이 없어서, 사업자 정보 저장이 RLS에 의해 조용히
-- 0건 적용된 채 "성공"으로 보이던 문제 수정.
create policy "내 조직 정보 수정" on public.organizations
  for update
  using (id = get_my_org_id())
  with check (id = get_my_org_id());
