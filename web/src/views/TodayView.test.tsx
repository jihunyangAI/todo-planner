import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayLocal, addDays } from '../domain/date';
import { apiError } from '../test/fakeApi';
import { makeTask } from '../test/factory';
import { renderApp, settle } from '../test/renderApp';

const TODAY = todayLocal();
const YESTERDAY = addDays(TODAY, -1);

describe('오늘 화면', () => {
  it('진행률을 "3/5 완료 (60%)"로 표시한다 (AC7)', async () => {
    const tasks = [
      ...[1, 2, 3].map(() => makeTask({ plannedDate: TODAY, completed: true })),
      makeTask({ plannedDate: TODAY }),
      makeTask({ plannedDate: TODAY }),
    ];
    await renderApp(tasks);
    expect(screen.getByTestId('progress-오늘 진행률')).toHaveTextContent('3/5 완료 (60%)');
  });

  it('예정 작업이 없으면 "계획 없음"과 섹션별 빈 목록 안내 (AC7, AC29)', async () => {
    await renderApp([]);
    expect(screen.getByTestId('progress-오늘 진행률')).toHaveTextContent('계획 없음');
    expect(screen.getByText('오늘 예정된 작업이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('지난 미완료 작업이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('마감이 임박한 작업이 없습니다.')).toBeInTheDocument();
  });

  it('"오늘 마감"·"기한 지남" 배지가 텍스트로 붙고, 완료하면 사라진다 (AC8)', async () => {
    const dueToday = makeTask({ title: '오늘 마감 작업', plannedDate: TODAY, dueDate: TODAY });
    const overdue = makeTask({ title: '지난 마감 작업', plannedDate: TODAY, dueDate: YESTERDAY });
    const { user, api } = await renderApp([dueToday, overdue]);
    expect(screen.getByText('오늘 마감')).toBeInTheDocument();
    expect(screen.getByText('기한 지남')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '지난 마감 작업' }));
    expect(screen.queryByText('기한 지남')).not.toBeInTheDocument();
    expect(api.take('patch').args).toEqual([overdue.id, { completed: true }]);
  });

  it('우선순위는 "높음"·"보통"·"낮음" 텍스트로, 완료 작업은 맨 아래에 "완료"로 표시된다 (AC25)', async () => {
    await renderApp([
      makeTask({ title: '완료됨', plannedDate: TODAY, priority: 'high', completed: true }),
      makeTask({ title: '낮음 작업', plannedDate: TODAY, priority: 'low' }),
      makeTask({ title: '높음 작업', plannedDate: TODAY, priority: 'high' }),
    ]);
    const list = screen.getByRole('list', { name: '오늘 예정' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('label')?.textContent)).toEqual([
      '높음 작업',
      '낮음 작업',
      '완료됨',
    ]);
    expect(within(items[0]!).getByText('높음')).toBeInTheDocument();
    expect(within(items[1]!).getByText('낮음')).toBeInTheDocument();
    expect(within(items[2]!).getByText('완료')).toBeInTheDocument();
  });

  it('완료된 작업의 체크를 다시 누르면 미완료가 된다 (AC26)', async () => {
    const done = makeTask({ title: '끝난 일', plannedDate: TODAY, completed: true, completedAt: '2026-01-01T00:00:00Z' });
    const { user, api } = await renderApp([done]);
    const checkbox = screen.getByRole('checkbox', { name: '끝난 일' });
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(api.take('patch').args).toEqual([done.id, { completed: false }]);
  });

  it('지난 미완료에서 완료하면 목록에서 빠지고 [되돌리기]로 돌아온다 (AC26)', async () => {
    const late = makeTask({ title: '어제 할 일', plannedDate: YESTERDAY });
    const { user, api } = await renderApp([late]);
    await user.click(screen.getByRole('checkbox', { name: '어제 할 일' }));
    expect(screen.getByText('지난 미완료 작업이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText(/완료했습니다/)).toBeInTheDocument();
    api.take('patch').resolve({ ...late, completed: true });
    await settle();

    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByRole('checkbox', { name: '어제 할 일' })).not.toBeChecked();
    expect(api.take('patch').args).toEqual([late.id, { completed: false }]);
  });

  it('완료가 저장 실패로 잠기면 완료 알림을 닫는다', async () => {
    const late = makeTask({ title: '어제 할 일', plannedDate: YESTERDAY });
    const { user, api } = await renderApp([late]);
    await user.click(screen.getByRole('checkbox', { name: '어제 할 일' }));
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeInTheDocument();
    api.take('patch').reject(apiError('transient'));
    await settle();
    expect(screen.queryByRole('button', { name: '되돌리기' })).not.toBeInTheDocument();
  });

  it('빈 제목으로 빠른 추가를 하면 오류가 보이고 저장되지 않는다 (AC1)', async () => {
    const { user, api } = await renderApp([]);
    await user.type(screen.getByLabelText('오늘 할 일 추가'), '   {Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('제목을 입력하세요');
    expect(api.pending('create')).toHaveLength(0);
  });

  it('빠른 추가는 실행 예정일을 오늘로 넣는다', async () => {
    const { user, api } = await renderApp([]);
    await user.type(screen.getByLabelText('오늘 할 일 추가'), '장보기{Enter}');
    expect(screen.getByRole('checkbox', { name: '장보기' })).toBeInTheDocument();
    expect(api.take('create').args[0]).toMatchObject({ title: '장보기', plannedDate: TODAY, priority: 'medium' });
  });
});

describe('저장 실패 (AC13)', () => {
  it('배너에 건수가 나오고, 잠긴 작업은 "저장 실패" 배지와 함께 편집이 막힌다', async () => {
    const a = makeTask({ title: 'A', plannedDate: TODAY });
    const { user, api } = await renderApp([a]);
    await user.click(screen.getByRole('checkbox', { name: 'A' }));
    api.take('patch').reject(apiError('transient'));
    await settle();

    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못한 변경 1건');
    expect(screen.getByText('저장 실패')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'A' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'A 수정' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'A 삭제' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeChecked();
    api.take('patch').resolve({ ...a, completed: true });
    await settle();
    expect(screen.queryByText('저장 실패')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeEnabled();
  });
});

describe('첫 로드 (AC35)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('3초 넘게 걸리면 "서버에 연결하는 중"을 보여 주고 쓰기 화면을 숨기며, 모두 실패하면 오류 화면', async () => {
    const { api } = await renderApp([], { load: false });
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
    expect(screen.queryByLabelText('오늘 할 일 추가')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_001);
    });
    expect(screen.getByText(/서버에 연결하는 중입니다/)).toBeInTheDocument();

    for (const wait of [2_000, 4_000, 8_000, 0]) {
      await act(async () => {
        for (const call of api.pending('list').splice(0)) call.reject(apiError('transient'));
        await vi.advanceTimersByTimeAsync(wait);
      });
    }
    expect(screen.getByRole('heading', { name: '서버에 연결하지 못했습니다' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});
