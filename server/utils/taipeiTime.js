const TIME_ZONE = 'Asia/Taipei'

const getTaipeiParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }
  )

  const parts = formatter.formatToParts(date)

  const values = {}

  for (const part of parts) {
    if (part.type === 'literal') {
      continue
    }

    values[part.type] = part.value
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

export const getTaipeiDateString = () => {
  const {
    year,
    month,
    day,
  } = getTaipeiParts()

  return [
    year,
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

export const canCancelTodayRecord = (
  recordDate
) => {
  const now = getTaipeiParts()

  const today = getTaipeiDateString()

  if (recordDate !== today) {
    return false
  }

  return now.hour < 12
}