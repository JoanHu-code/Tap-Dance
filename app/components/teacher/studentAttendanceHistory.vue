<script setup>
// ============================================================
// Props
// ============================================================

const props =
  defineProps({
    records: {
      type: Array,
      default: () => [],
    },

    savingId: {
      type: String,
      default: '',
    },
  })

// ============================================================
// Emits
// ============================================================

const emit =
  defineEmits([
    'change',
  ])

// ============================================================
// Format
// ============================================================

const formatDate = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    10
  )
}

const formatTime = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    5
  )
}

// ============================================================
// Label
// ============================================================

const getStatusLabel = (
  value
) => {
  if (
    value ===
    'ATTENDED'
  ) {
    return '簽到'
  }

  if (
    value ===
    'LEAVE'
  ) {
    return '請假'
  }

  return value ||
    '-'
}

// ============================================================
// Change
// ============================================================

const changeStatus = (
  record,
  status
) => {
  if (
    props.savingId ===
    String(
      record.id
    )
  ) {
    return
  }

  if (
    record.status ===
    status
  ) {
    return
  }

  emit(
    'change',
    {
      attendanceId:
        record.id,

      courseId:
        record.actual_course_id,

      classDate:
        formatDate(
          record.class_date
        ),

      status,

      note:
        record.note ||
        null,
    }
  )
}
</script>

<template>
  <section class="history">
    <header>
      <div>
        <span>
          History
        </span>

        <h2>
          上課紀錄
        </h2>
      </div>

      <span>
        {{
          records.length
        }}
        筆
      </span>
    </header>

    <!-- ======================================================
         Records
         ====================================================== -->

    <div
      v-if="
        records.length
      "
      class="record-list"
    >
      <article
        v-for="
          record in records
        "
        :key="
          record.id
        "
        class="record"
      >
        <!-- ==================================================
             Main
             ================================================== -->

        <div class="record-main">
          <div>
            <span>
              {{
                formatDate(
                  record.class_date
                )
              }}
            </span>

            <strong>
              {{
                record.actual_course_name ||
                '課堂'
              }}
            </strong>

            <small>
              {{
                formatTime(
                  record.start_time
                )
              }}
              –
              {{
                formatTime(
                  record.end_time
                )
              }}
            </small>
          </div>

          <span
            class="status"
            :class="{
              attended:
                record.status ===
                  'ATTENDED',

              leave:
                record.status ===
                  'LEAVE',
            }"
          >
            {{
              getStatusLabel(
                record.status
              )
            }}
          </span>
        </div>

        <!-- ==================================================
             Note
             ================================================== -->

        <p
          v-if="
            record.note
          "
          class="note"
        >
          {{
            record.note
          }}
        </p>

        <!-- ==================================================
             Actions
             ================================================== -->

        <div
          v-if="
            [
              'ATTENDED',
              'LEAVE',
            ].includes(
              record.status
            )
          "
          class="actions"
        >
          <button
            type="button"
            :class="{
              selected:
                record.status ===
                  'ATTENDED',
            }"
            :disabled="
              savingId ===
                String(
                  record.id
                )
            "
            @click="
              changeStatus(
                record,
                'ATTENDED'
              )
            "
          >
            {{
              savingId ===
                String(
                  record.id
                )
                ? '儲存中...'
                : '簽到'
            }}
          </button>

          <button
            type="button"
            :class="{
              selected:
                record.status ===
                  'LEAVE',
            }"
            :disabled="
              savingId ===
                String(
                  record.id
                )
            "
            @click="
              changeStatus(
                record,
                'LEAVE'
              )
            "
          >
            {{
              savingId ===
                String(
                  record.id
                )
                ? '儲存中...'
                : '請假'
            }}
          </button>
        </div>

        <!-- ==================================================
             Legacy
             ================================================== -->

        <div
          v-else
          class="legacy"
        >
          這是舊版
          {{
            record.status
          }}
          紀錄，暫時保留歷史資料。
        </div>
      </article>
    </div>

    <div
      v-else
      class="empty"
    >
      還沒有上課紀錄。
    </div>
  </section>
</template>

<style scoped>
.history > header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.history header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.history h2 {
  margin: 3px 0 0;
  font-size: 17px;
}

.history > header > span {
  color: #999999;
  font-size: 8px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 9px;
}

.record {
  padding: 12px;
  background: #ffffff;
  border-radius: 13px;
}

.record-main {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.record-main > div > span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.record-main strong {
  display: block;
  margin-top: 3px;
  font-size: 11px;
}

.record-main small {
  display: block;
  margin-top: 3px;
  color: #888888;
  font-size: 7px;
}

.status {
  height: fit-content;
  padding: 5px 8px;
  background: #eeeeee;
  border-radius: 999px;
  color: #777777;
  font-size: 8px;
}

.status.attended {
  background: #eaf7ec;
  color: #418b4b;
}

.status.leave {
  background: #fff5df;
  color: #856319;
}

.note {
  margin: 8px 0 0;
  padding: 8px;
  background: #f7f7f7;
  border-radius: 8px;
  color: #777777;
  font-size: 8px;
}

.actions {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 6px;
  margin-top: 9px;
}

.actions button {
  min-height: 33px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  color: #666666;
  font-size: 8px;
}

.actions button:first-child.selected {
  background: #eaf7ec;
  color: #418b4b;
}

.actions button:last-child.selected {
  background: #fff5df;
  color: #856319;
}

.actions button:disabled {
  opacity: 0.4;
}

.legacy {
  margin-top: 8px;
  color: #999999;
  font-size: 7px;
}

.empty {
  margin-top: 9px;
  padding: 27px;
  background: #ffffff;
  border-radius: 13px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}
</style>