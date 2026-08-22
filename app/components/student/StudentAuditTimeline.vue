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

    pagination: {
      type: Object,
      default: () => ({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      }),
    },

    loading: {
      type: Boolean,
      default: false,
    },
  })

// ============================================================
// Emits
// ============================================================

const emit =
  defineEmits([
    'previous',
    'next',
  ])

// ============================================================
// Expanded
// ============================================================

const expandedIds =
  ref(
    new Set()
  )

// ============================================================
// Toggle
// ============================================================

const toggleExpanded = (
  id
) => {
  const next =
    new Set(
      expandedIds.value
    )

  if (
    next.has(
      id
    )
  ) {
    next.delete(
      id
    )
  } else {
    next.add(
      id
    )
  }

  expandedIds.value =
    next
}

const isExpanded = (
  id
) => {
  return expandedIds.value
    .has(
      id
    )
}

// ============================================================
// Date
// ============================================================

const formatDateTime = (
  value
) => {
  if (!value) {
    return '-'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    )
  }

  return new Intl
    .DateTimeFormat(
      'zh-TW',
      {
        timeZone:
          'Asia/Taipei',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        second:
          '2-digit',

        hourCycle:
          'h23',
      }
    )
    .format(
      date
    )
}

// ============================================================
// Class Date
// ============================================================

const formatClassDate = (
  value
) => {
  if (!value) {
    return ''
  }

  return String(
    value
  ).slice(
    0,
    10
  )
}

// ============================================================
// Time
// ============================================================

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
// Action
// ============================================================

const getActionLabel = (
  value
) => {
  const map = {
    CREATE:
      '新增',

    UPDATE:
      '修改',

    CANCEL:
      '取消',

    RESTORE:
      '恢復',

    RENEW:
      '續期',

    LINK:
      '綁定',

    UNLINK:
      '解除綁定',
  }

  return (
    map[value] ||
    value ||
    '-'
  )
}

// ============================================================
// Entity
// ============================================================

const getEntityLabel = (
  value
) => {
  const map = {
    ATTENDANCE:
      '出席紀錄',

    LEAVE:
      '請假',

    MAKEUP:
      '補課',

    SESSION:
      '課堂',

    PACKAGE:
      '堂數方案',

    ENROLLMENT:
      '選課',

    STUDENT:
      '學生資料',

    USER:
      '帳號',

    SCHEDULE:
      '固定時段',
  }

  return (
    map[value] ||
    value ||
    '-'
  )
}

// ============================================================
// Actor
// ============================================================

const getActorLabel = (
  log
) => {
  if (
    log.actor_label
  ) {
    return log.actor_label
  }

  if (
    log.actor_role ===
    'STUDENT'
  ) {
    return '我'
  }

  if (
    log.actor_role ===
    'TEACHER'
  ) {
    return '老師'
  }

  return '系統'
}

// ============================================================
// JSON
// ============================================================

const stringifyJson = (
  value
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return '-'
  }

  try {
    return JSON.stringify(
      value,
      null,
      2
    )
  } catch {
    return String(
      value
    )
  }
}
</script>

<template>
  <section class="timeline">
    <!-- ======================================================
         Loading
         ====================================================== -->

    <div
      v-if="
        loading
      "
      class="empty-state"
    >
      載入操作紀錄中...
    </div>

    <!-- ======================================================
         Timeline
         ====================================================== -->

    <div
      v-else-if="
        records.length
      "
      class="timeline-list"
    >
      <article
        v-for="
          log in records
        "
        :key="
          log.id
        "
        class="timeline-item"
      >
        <!-- Dot -->

        <div
          class="timeline-marker"
          :class="
            `timeline-marker--${String(log.action || '').toLowerCase()}`
          "
        />

        <!-- Card -->

        <div class="timeline-card">
          <header class="card-header">
            <div class="title-area">
              <div class="badges">
                <span
                  class="action-badge"
                  :class="
                    `action-badge--${String(log.action || '').toLowerCase()}`
                  "
                >
                  {{
                    getActionLabel(
                      log.action
                    )
                  }}
                </span>

                <span class="entity-badge">
                  {{
                    getEntityLabel(
                      log.entity_type
                    )
                  }}
                </span>
              </div>

              <h3>
                {{
                  log.note ||
                  `${getEntityLabel(log.entity_type)} ${getActionLabel(log.action)}`
                }}
              </h3>
            </div>

            <button
              type="button"
              class="detail-button"
              @click="
                toggleExpanded(
                  log.id
                )
              "
            >
              {{
                isExpanded(
                  log.id
                )
                  ? '收合'
                  : '詳細'
              }}
            </button>
          </header>

          <!-- =================================================
               Basic Info
               ================================================= -->

          <div class="meta">
            <span>
              {{
                formatDateTime(
                  log.created_at
                )
              }}
            </span>

            <span>
              操作者：
              {{
                getActorLabel(
                  log
                )
              }}
            </span>
          </div>

          <!-- Course -->

          <div
            v-if="
              log.course_name
            "
            class="info-row"
          >
            <span>
              課程
            </span>

            <strong>
              {{
                log.course_name
              }}
            </strong>
          </div>

          <!-- Session -->

          <div
            v-if="
              log.class_date
            "
            class="info-row"
          >
            <span>
              課堂
            </span>

            <strong>
              {{
                formatClassDate(
                  log.class_date
                )
              }}

              <template
                v-if="
                  log.start_time
                "
              >
                ・
                {{
                  formatTime(
                    log.start_time
                  )
                }}
              </template>

              <template
                v-if="
                  log.schedule_name
                "
              >
                ・
                {{
                  log.schedule_name
                }}
              </template>
            </strong>
          </div>

          <!-- =================================================
               Details
               ================================================= -->

          <div
            v-if="
              isExpanded(
                log.id
              )
            "
            class="details"
          >
            <div class="id-row">
              <span>
                紀錄 ID
              </span>

              <code>
                {{
                  log.id
                }}
              </code>
            </div>

            <div class="id-row">
              <span>
                Entity ID
              </span>

              <code>
                {{
                  log.entity_id ||
                  '-'
                }}
              </code>
            </div>

            <div class="json-section">
              <div>
                <span>
                  修改前
                </span>

                <pre>{{
                  stringifyJson(
                    log.before_data
                  )
                }}</pre>
              </div>

              <div>
                <span>
                  修改後
                </span>

                <pre>{{
                  stringifyJson(
                    log.after_data
                  )
                }}</pre>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <!-- ======================================================
         Empty
         ====================================================== -->

    <div
      v-else
      class="empty-state"
    >
      目前沒有符合條件的操作紀錄。
    </div>

    <!-- ======================================================
         Pagination
         ====================================================== -->

    <footer
      v-if="
        pagination.total >
        0
      "
      class="pagination"
    >
      <button
        type="button"
        :disabled="
          loading ||
          !pagination.hasPrevious
        "
        @click="
          emit(
            'previous'
          )
        "
      >
        ← 上一頁
      </button>

      <span>
        第
        {{
          pagination.page
        }}
        /
        {{
          pagination.totalPages
        }}
        頁

        ・

        {{
          pagination.total
        }}
        筆
      </span>

      <button
        type="button"
        :disabled="
          loading ||
          !pagination.hasNext
        "
        @click="
          emit(
            'next'
          )
        "
      >
        下一頁 →
      </button>
    </footer>
  </section>
</template>

<style scoped>
.timeline {
  position: relative;
}

.timeline-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-list::before {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 6px;
  width: 1px;
  background: #dddddd;
  content: '';
}

.timeline-item {
  position: relative;
  padding-left: 23px;
}

.timeline-marker {
  position: absolute;
  top: 18px;
  left: 1px;
  z-index: 2;
  width: 11px;
  height: 11px;
  background: #ffffff;
  border: 2px solid #888888;
  border-radius: 50%;
}

.timeline-marker--create {
  border-color: #5f9864;
}

.timeline-marker--update {
  border-color: #888888;
}

.timeline-marker--cancel {
  border-color: #c94343;
}

.timeline-marker--restore {
  border-color: #5079b9;
}

.timeline-marker--renew {
  border-color: #a57b2b;
}

.timeline-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 16px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.title-area {
  min-width: 0;
  flex: 1;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.action-badge,
.entity-badge {
  min-height: 22px;
  padding:
    4px
    7px;
  border-radius: 999px;
  font-size: 8px;
}

.action-badge {
  background: #eeeeee;
}

.action-badge--create {
  background: #eef8ee;
  color: #4b8e50;
}

.action-badge--cancel {
  background: #fff0f0;
  color: #c94343;
}

.action-badge--restore {
  background: #eef4ff;
  color: #5079b9;
}

.action-badge--renew {
  background: #fff5df;
  color: #98701e;
}

.entity-badge {
  background: #f5f5f5;
  color: #777777;
}

.timeline-card h3 {
  margin:
    8px
    0
    0;
  font-size: 12px;
  line-height: 1.5;
}

.detail-button {
  flex: 0 0 auto;
  min-height: 29px;
  padding:
    0
    8px;
  border: 0;
  background: #f2f2f2;
  border-radius: 8px;
  color: #666666;
  font-size: 8px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap:
    4px
    10px;
  margin-top: 8px;
  color: #999999;
  font-size: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  margin-top: 8px;
  padding: 8px 9px;
  background: #f7f7f7;
  border-radius: 9px;
}

.info-row span {
  color: #999999;
  font-size: 8px;
}

.info-row strong {
  min-width: 0;
  font-size: 9px;
  text-align: right;
}

.details {
  margin-top: 11px;
  padding-top: 11px;
  border-top: 1px solid #eeeeee;
}

.id-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 7px;
}

.id-row span,
.json-section span {
  color: #999999;
  font-size: 8px;
}

.id-row code {
  overflow-wrap: anywhere;
  color: #666666;
  font-size: 8px;
}

.json-section {
  display: grid;
  grid-template-columns:
    1fr;
  gap: 8px;
  margin-top: 10px;
}

.json-section pre {
  max-height: 280px;
  margin:
    5px
    0
    0;
  padding: 10px;
  overflow: auto;
  background: #171717;
  border-radius: 9px;
  color: #eeeeee;
  font-size: 8px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.empty-state {
  padding: 30px;
  background: #ffffff;
  border-radius: 16px;
  color: #aaaaaa;
  font-size: 10px;
  text-align: center;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  margin-top: 15px;
}

.pagination button {
  min-height: 34px;
  padding:
    0
    10px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  color: #555555;
  font-size: 8px;
}

.pagination button:disabled {
  opacity: 0.4;
}

.pagination span {
  color: #888888;
  font-size: 8px;
  text-align: center;
}
</style>