import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addDays, formatShortDate, todayLocal, weekStart } from '../domain/date';
import { apiError, flush } from '../test/fakeApi';
import { makeTask } from '../test/factory';
import { TEST_USER, renderApp, settle } from '../test/renderApp';
import { DATA_NOTICE } from './SettingsView';

const TODAY = todayLocal();

describe('할 일 폼', () => {
  it('[자세히]로 연 폼: 공백 제목은 오류, 우선순위 기본값은 보통 (AC1, AC25)', async () => {
    const { user, api } = await renderApp([], { hash: '#/all' });
    await user.click(screen.getByRole('button', { name: '자세히' }));
    const dialog = screen.getByRole('dialog', { name: '새 할 일' });
    expect(within(dialog).getByLabelText('우선순위')).toHaveValue('medium');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('제목을 입력하세요');
    expect(api.pending('create')).toHaveLength(0);
  });

  it('실행 예정일이 마감일보다 늦으면 경고를 보여 주지만 저장된다 (AC4)', async () => {
    const { user, api } = await renderApp([], { hash: '#/all' });
    await user.click(screen.getByRole('button', { name: '자세히' }));
    const dialog = screen.getByRole('dialog', { name: '새 할 일' });
    await user.type(within(dialog).getByLabelText('제목 (필수)'), '보고서');
    await user.type(within(dialog).getByLabelText('실행 예정일'), '2026-09-30');
    await user.type(within(dialog).getByLabelText('마감일'), '2026-09-25');
    expect(within(dialog).getByText(/마감일보다 늦습니다/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(api.pending('create')).toHaveLength(1);
    expect(api.take('create').args[0]).toMatchObject({
      title: '보고서',
      plannedDate: '2026-09-30',
      dueDate: '2026-09-25',
    });
  });

  it('수정 폼에서 마감일을 해제하면 마감 배지가 사라지고 null로 PATCH한다 (AC27)', async () => {
    const task = makeTask({ title: '제출', dueDate: TODAY });
    const { user, api } = await renderApp([task], { hash: '#/all' });
    expect(screen.getByText('오늘 마감')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '제출 수정' }));
    const dialog = screen.getByRole('dialog', { name: '할 일 수정' });
    await user.click(within(dialog).getByRole('button', { name: '마감일 해제' }));
    await user.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(screen.queryByText('오늘 마감')).not.toBeInTheDocument();
    expect(api.take('patch').args).toEqual([task.id, { dueDate: null }]);
  });
});

describe('삭제 (AC11)', () => {
  it('확인 대화상자에서 취소하면 남고, 삭제를 누르면 지운다', async () => {
    const task = makeTask({ title: '지울 일' });
    const { user, api } = await renderApp([task], { hash: '#/all' });
    await user.click(screen.getByRole('button', { name: '지울 일 삭제' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect(screen.getByRole('checkbox', { name: '지울 일' })).toBeInTheDocument();
    expect(api.pending('remove')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '지울 일 삭제' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    expect(screen.queryByRole('checkbox', { name: '지울 일' })).not.toBeInTheDocument();
    expect(api.take('remove').args).toEqual([task.id]);
  });
});

describe('일정 메뉴 (AC27)', () => {
  it('실행 예정일을 해제하면 미계획이 되어 오늘 진행률에서 빠진다', async () => {
    const task = makeTask({ title: '오늘 일', plannedDate: TODAY });
    const { user, api } = await renderApp([task]);
    expect(screen.getByTestId('progress-오늘 진행률')).toHaveTextContent('0/1 완료 (0%)');
    await user.click(screen.getByRole('button', { name: '오늘 일 실행 예정일 변경' }));
    await user.click(within(screen.getByRole('group', { name: '실행 예정일 변경' })).getByRole('button', { name: '해제' }));
    expect(screen.getByTestId('progress-오늘 진행률')).toHaveTextContent('계획 없음');
    expect(api.take('patch').args).toEqual([task.id, { plannedDate: null }]);
  });
});

describe('전체 화면 (AC10, AC29)', () => {
  it('작업이 없으면 "아직 할 일이 없습니다"', async () => {
    await renderApp([], { hash: '#/all' });
    expect(screen.getByText('아직 할 일이 없습니다.')).toBeInTheDocument();
  });

  it('URL의 필터가 적용되고, 결과가 없으면 "검색 결과 없음"과 필터 초기화', async () => {
    const tasks = [
      makeTask({ title: '영어 단어', category: 'study' }),
      makeTask({ title: '영어 회의', category: 'work' }),
    ];
    const { user } = await renderApp(tasks, { hash: '#/all?q=%EC%98%81%EC%96%B4&category=study' });
    const list = screen.getByRole('list', { name: '전체 할 일' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('영어 단어')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('상태'), 'done');
    expect(window.location.hash).toContain('status=done');
    expect(screen.getByText('검색 결과 없음')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '필터 초기화' }));
    expect(within(screen.getByRole('list', { name: '전체 할 일' })).getAllByRole('listitem')).toHaveLength(2);
    expect(window.location.hash).toBe('#/all');
  });

  it('빠른 추가는 날짜 없이 등록한다', async () => {
    const { user, api } = await renderApp([], { hash: '#/all' });
    await user.type(screen.getByLabelText('할 일 추가 (날짜 없이)'), '언젠가{Enter}');
    expect(api.take('create').args[0]).toMatchObject({ title: '언젠가', plannedDate: null });
  });
});

describe('주간 화면 (AC9, AC28, AC29)', () => {
  it('월요일부터 시작하고, 다음 주를 누르면 7일 뒤 구간이 보인다', async () => {
    const { user } = await renderApp([], { hash: '#/week' });
    const monday = weekStart(TODAY);
    expect(screen.getByTestId('week-range')).toHaveTextContent(
      `${formatShortDate(monday)} ~ ${formatShortDate(addDays(monday, 6))}`,
    );
    expect(screen.getByRole('region', { name: `${formatShortDate(TODAY)} 오늘` })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다음 주' }));
    expect(screen.getByTestId('week-range')).toHaveTextContent(formatShortDate(addDays(monday, 7)));
    await user.click(screen.getByRole('button', { name: '이번 주' }));
    expect(screen.getByTestId('week-range')).toHaveTextContent(formatShortDate(monday));
  });

  it('주간 진행률은 표시 중인 주만 세고, 삭제하면 다시 계산된다. 미계획 패널에 날짜 없는 작업이 나온다', async () => {
    const monday = weekStart(TODAY);
    const inWeek = makeTask({ title: '이번 주 완료', plannedDate: monday, completed: true });
    const inWeek2 = makeTask({ title: '이번 주 미완료', plannedDate: addDays(monday, 6) });
    const nextWeek = makeTask({ title: '다음 주 일', plannedDate: addDays(monday, 7) });
    const unplanned = makeTask({ title: '날짜 없는 일' });
    const { user } = await renderApp([inWeek, inWeek2, nextWeek, unplanned], { hash: '#/week' });
    expect(screen.getByTestId('progress-주간 진행률')).toHaveTextContent('1/2 완료 (50%)');
    expect(within(screen.getByRole('list', { name: '미계획' })).getByText('날짜 없는 일')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '이번 주 완료 삭제' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    expect(screen.getByTestId('progress-주간 진행률')).toHaveTextContent('0/1 완료 (0%)');
  });

  it('이번 주를 보는 중에 날짜가 다음 주 월요일로 넘어가면 새 주로 바뀐다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const sunday = new Date(2026, 8, 27, 12, 0, 0);
      vi.setSystemTime(sunday);
      await renderApp([], { hash: '#/week' });
      expect(screen.getByTestId('week-range')).toHaveTextContent('9/21 (월) ~ 9/27 (일)');
      vi.setSystemTime(new Date(2026, 8, 28, 9, 0, 0));
      document.dispatchEvent(new Event('visibilitychange'));
      await settle();
      expect(screen.getByTestId('week-range')).toHaveTextContent('9/28 (월) ~ 10/4 (일)');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('설정 화면', () => {
  it('데이터 보관 방식 안내를 표시한다 (AC30)', async () => {
    await renderApp([], { hash: '#/settings' });
    expect(screen.getByText(DATA_NOTICE)).toBeInTheDocument();
  });

  it('GitHub 사용자 이름과 아바타를 보여 준다', async () => {
    await renderApp([], { hash: '#/settings' });
    expect(screen.getByText(TEST_USER.username)).toBeInTheDocument();
    const avatar = screen.getByRole('img', { name: `${TEST_USER.username} 프로필 사진` });
    expect(avatar).toHaveAttribute('src', TEST_USER.avatarUrl);
  });

  it('로그아웃을 누르면 logout을 호출한다', async () => {
    const { user, logout } = await renderApp([], { hash: '#/settings' });
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('로그아웃 요청이 실패하면 오류를 보여 주고 다시 누를 수 있다', async () => {
    const { user, logout } = await renderApp([], { hash: '#/settings' });
    logout.mockRejectedValueOnce(new Error('network'));
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다');
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled();
  });

  it('저장하지 못한 변경이 있으면 사라진다고 확인을 받은 뒤 로그아웃한다', async () => {
    const task = makeTask({ title: 'A' });
    const { user, api, logout } = await renderApp([task], { hash: '#/all' });
    await user.click(screen.getByRole('checkbox', { name: 'A' }));
    api.take('patch').reject(apiError('transient'));
    await settle();

    await user.click(screen.getByRole('link', { name: '설정' }));
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    const dialog = screen.getByRole('dialog', { name: '로그아웃할까요?' });
    expect(within(dialog).getByText(/저장하지 못한 변경 1건/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(logout).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '로그아웃' }));
    expect(logout).toHaveBeenCalledOnce();
  });
});

describe('로그인 만료', () => {
  it('저장 중 401이면 변경은 실패 목록에 남고 다시 로그인 링크가 보인다', async () => {
    const task = makeTask({ title: 'A', plannedDate: TODAY });
    const { user, api } = await renderApp([task]);
    await user.click(screen.getByRole('checkbox', { name: 'A' }));
    api.take('patch').reject(apiError('unauthorized'));
    await settle();
    expect(screen.getByText(/로그인이 만료되었습니다/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다시 로그인' })).toHaveAttribute('href', '/auth/github');
    expect(screen.getByText('저장하지 못한 변경 1건')).toBeInTheDocument();
  });

  it('첫 로드가 401이면 로그인 화면을 보여 준다', async () => {
    const { api } = await renderApp([], { load: false });
    await act(async () => {
      api.take('list').reject(apiError('unauthorized'));
      await flush();
    });
    expect(screen.getByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub로 로그인' })).toHaveAttribute('href', '/auth/github');
  });
});

describe('라우팅 (AC23)', () => {
  it('알 수 없는 경로면 오늘 화면을 연다', async () => {
    await renderApp([], { hash: '#/nowhere' });
    expect(screen.getByRole('heading', { name: '오늘', level: 1 })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/today');
  });
});
