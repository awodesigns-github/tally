import type { Habit, HabitId } from '../../src/lib/api';

const h = (i: number, name: string, streak: number, loggedToday: boolean): Habit => ({
  _id: `fixture${i}` as HabitId,
  _creationTime: 1_700_000_000_000 + i,
  name,
  streak,
  loggedToday,
});

export const demo: Habit[] = [
  h(1, 'Read 10 pages', 5, true),
  h(2, 'Drink water', 2, false),
  h(3, 'Stretch', 0, false),
];

// Each row is something a real user could type; names are at most 60 chars (habitName.ts:3).
export const worst: Habit[] = [
  h(1, 'Practise Rachmaninoff Prelude in C-sharp minor, slow tempo!', 1284, true), // 60 chars, 4-digit streak
  h(2, 'Z', 1, false), // one letter, singular
  h(3, 'https://duolingo.com/learn/japanese/hiragana-unit-three-quiz', 7, true), // 60, unbreakable, milestone
  h(4, 'Tập thể dục buổi sáng ở công viên Thống Nhất với bạn bè', 0, false), // Vietnamese diacritics
  h(5, '🧘‍♀️👨‍👩‍👧‍👦🏳️‍🌈 Meditate', 99, false), // ZWJ emoji first
  h(6, 'قراءة جزء من القرآن الكريم كل يوم بعد صلاة الفجر', 12, true), // RTL
  h(7, 'Ｗｒｉｔｅ　ｍｏｒｎｉｎｇ　ｐａｇｅｓ　ｉｎ　ｔｈｅ　ｊｏｕｒｎａｌ', 10000, false), // full-width
];

export const one: Habit[] = [h(1, 'Walk', 1, true)];
export const huge: Habit[] = Array.from({ length: 1000 }, (_, i) => h(i, `Habit number ${i + 1}`, i % 40, i % 3 === 0));
