<script setup>
const props =
  defineProps({
    log: {
      type: Object,
      required: true,
    },

    compact: {
      type: Boolean,
      default: false,
    },
  })

const expanded =
  ref(false)

// ============================================================
// DateTime
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
// Date
// ============================================================

const formatDate = (
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
  action
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
    map[action] ||
    action ||
    '-'
  )
}

// ============================================================
// Entity
// ============================================================

const getEntityLabel = (
  entityType
) => {
  const map = {
    ATTENDANCE:
      '出席',

    LEAVE:
      '請假',

    MAKEUP:
      '補課',

    SESSION:
      '課堂',

    PACKAGE:
      '方案',

    ENROLLMENT:
      '選課',

    STUDENT:
      '學生',

    USER:
      '帳號',
  }

  return (
    map[entityType] ||
    entityType ||
    '-'
  )
}

// ============================================================
// Actor
// ============================================================

const actorLabel =
  computed(() => {
    if (
      props.log.actor_name
    ) {
      return props.log.actor_name
    }

    if (
      props.log.actor_role ===
      'TEACHER'
    ) {
      return '老師'
    }

    if (
      props.log.actor_role ===
      'STUDENT'
    ) {
      return '學生'
    }

    if (
      props.log.actor_role ===
      'SYSTEM'
    ) {
      return '系統'
    }

    return '-'
  })

// ============================================================
// JSON
// ============================================================

const stringifyJson = (
  value
) => {
  if (
    value === undefined ||
    value === null
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
  <article
    class="audit-card"
    :class="{
      'audit-card--compact':
        compact,
    }"
  >
    <!-- ======================================================
         Header
         ====================================================== -->

    <header class="audit-header">
      <div class="audit-main">
        <div class="badges">
          <span
            class="action-badge"
            :class="
              `action-${String(log.action || '').toLowerCase()}`
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
              actorLabel
            }}
          </span>

          <span
            v-if="
              log.student_name
            "
          >
            學生：
            {{
              log.student_name
            }}
          </span>

          <span
            v-if="
              log.course_name
            "
          >
            課程：
            {{
              log.course_name
            }}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="expand-button"
        @click="
          expanded =
            !expanded
        "
      >
        {{
          expanded
            ? '收合'
            : '詳細'
        }}
      </button>
    </header>

    <!-- ======================================================
         Session
         ====================================================== -->

    <div
      v-if="
        log.session_id &&
        log.class_date
      "
      class="session-row"
    >
      <span>
        課堂
      </span>

      <strong>
        {{
          formatDate(
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

    <!-- ======================================================
         Detail
         ====================================================== -->

    <div
      v-if="
        expanded
      "
      class="detail"
    >
      <div class="id-grid">
        <div>
          <span>
            Audit ID
          </span>

          <code>
            {{
              log.id ||
              '-'
            }}
          </code>
        </div>

        <div>
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

        <div>
          <span>
            Request ID
          </span>

          <code>
            {{
              log.request_id ||
              '-'
            }}
          </code>
        </div>

        <div>
          <span>
            IP
          </span>

          <code>
            {{
              log.ip_address ||
              '-'
            }}
          </code>
        </div>
      </div>

      <div class="json-grid">
        <div>
          <span>
            Before
          </span>

          <pre>{{
            stringifyJson(
              log.before_data
            )
          }}</pre>
        </div>

        <div>
          <span>
            After
          </span>

          <pre>{{
            stringifyJson(
              log.after_data
            )
          }}</pre>
        </div>
      </div>

      <div
        v-if="
          log.user_agent
        "
        class="user-agent"
      >
        <span>
          User Agent
        </span>

        <code>
          {{
            log.user_agent
          }}
        </code>
      </div>
    </div>
  </article>
</template>

<style scoped>
.audit-card {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 17px;
}

.audit-card--compact {
  padding: 13px;
}

.audit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.audit-main {
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
  display: inline-flex;
  align-items: center;
  min-height: 23px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 8px;
}

.action-badge {
  background: #eeeeee;
}

.action-create {
  background: #eef8ee;
  color: #4b8e50;
}

.action-update {
  background: #f2f2f2;
  color: #666666;
}

.action-cancel {
  background: #fff0f0;
  color: #c94343;
}

.action-restore {
  background: #eef4ff;
  color: #5079b9;
}

.action-renew {
  background: #fff5df;
  color: #9c711f;
}

.entity-badge {
  background: #f6f6f6;
  color: #888888;
}

.audit-main h3 {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
  margin-top: 7px;
  color: #999999;
  font-size: 9px;
}

.expand-button {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 9px;
  border: 0;
  background: #f2f2f2;
  border-radius: 8px;
  color: #555555;
  font-size: 9px;
  cursor: pointer;
}

.session-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 11px;
  padding: 9px 10px;
  background: #f7f7f7;
  border-radius: 10px;
}

.session-row span {
  color: #999999;
  font-size: 8px;
}

.session-row strong {
  font-size: 9px;
}

.detail {
  margin-top: 13px;
  padding-top: 13px;
  border-top: 1px solid #eeeeee;
}

.id-grid {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
}

.id-grid > div,
.user-agent {
  min-width: 0;
  padding: 9px;
  background: #f7f7f7;
  border-radius: 9px;
}

.id-grid span,
.json-grid span,
.user-agent span {
  display: block;
  color: #999999;
  font-size: 8px;
}

.id-grid code,
.user-agent code {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: #555555;
  font-size: 8px;
}

.json-grid {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
  margin-top: 8px;
}

.json-grid > div {
  min-width: 0;
}

.json-grid pre {
  max-height: 300px;
  margin: 5px 0 0;
  padding: 10px;
  overflow: auto;
  background: #161616;
  border-radius: 9px;
  color: #eeeeee;
  font-size: 8px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.user-agent {
  margin-top: 8px;
}

@media (
  max-width: 600px
) {
  .id-grid,
  .json-grid {
    grid-template-columns:
      1fr;
  }

  .audit-header {
    gap: 8px;
  }
}
</style>