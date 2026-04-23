import { db } from '@/db/client';
import { categories, habitLogs, habits } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function exportHabitLogsCsv(): Promise<void> {
  // Join habit_logs → habits → categories
  const rows = await db
    .select({
      date: habitLogs.date,
      habitName: habits.name,
      category: categories.name,
      completed: habitLogs.completed,
      count: habitLogs.count,
    })
    .from(habitLogs)
    .innerJoin(habits, eq(habitLogs.habitId, habits.id))
    .innerJoin(categories, eq(habits.categoryId, categories.id))
    .orderBy(habitLogs.date, habits.name);

  const header = 'Date,Habit,Category,Completed,Count\n';

  const body = rows
    .map((r) => {
      const completed = r.completed === 1 ? 'Yes' : 'No';
      // Wrap fields that might contain commas in quotes
      const habit = `"${r.habitName.replace(/"/g, '""')}"`;
      const category = `"${r.category.replace(/"/g, '""')}"`;
      // Format: Date,Habit,Category,Completed,Count
      return `${r.date},${habit},${category},${completed},${r.count}`;
    })
    .join('\n');

  const csv = header + body;

  // Use the current date in the filename
  const filename = `habit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  const path = FileSystem.documentDirectory + filename;

  // Write the CSV string to a file
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // Share the file using the native sharing dialog
  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export Habit Logs',
  });
}
