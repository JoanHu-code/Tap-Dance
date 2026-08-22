<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
})

// ============================================================
// State
// ============================================================

const loading =
  ref(true)

const errorMessage =
  ref('')

const records =
  ref([])

const options =
  ref({
    students: [],
    courses: [],
    actors: [],
    actions: [],
    entityTypes: [],
  })

const summary =
  ref({
    total: 0,
    create: 0,
    update: 0,
    cancel: 0,
    restore: 0,
  })

const pagination =
  ref({
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  })

// ============================================================
// Filters
// ============================================================

const filters =
  reactive({
    studentId: '',
    courseId: '',
    actorUserId: '',
    actorRole: '',
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    keyword: '',
  })

// ============================================================
// Action Label
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
    action
  )
}

// ============================================================
// Entity Label
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
    entityType
  )
}

// ============================================================
// Actor
// ============================================================

const getActorLabel = (
  actor
) => {
  const name =
    actor.display_name ||
    '未命名帳號'

  const role =
    actor.role ===
      'TEACHER'
      ? '老師'
      : (
          actor.role ===
            'STUDENT'
            ? '學生'
            : actor.role
        )

  return `${name}｜${role}`
}

// ============================================================
// Fetch
// ============================================================

const fetchAuditLogs =
  async (
    page =
      pagination.value.page
  ) => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/audit',
          {
            query: {
              studentId:
                filters.studentId ||
                undefined,

              courseId:
                filters.courseId ||
                undefined,

              actorUserId:
                filters.actorUserId ||
                undefined,

              actorRole:
                filters.actorRole ||
                undefined,

              action:
                filters.action ||
                undefined,

              entityType:
                filters.entityType ||
                undefined,

              startDate:
                filters.startDate ||
                undefined,

              endDate:
                filters.endDate ||
                undefined,

              keyword:
                filters.keyword
                  .trim() ||
                undefined,

              page,

              pageSize:
                pagination.value
                  .pageSize,
            },
          }
        )

      records.value =
        response.records ||
        []

      options.value =
        response.options ||
        options.value

      summary.value =
        response.summary ||
        summary.value

      pagination.value =
        response.pagination ||
        pagination.value
    } catch (error) {
      console.error(
        'Audit Log 載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'Audit Log 載入失敗'
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Search
// ============================================================

const search =
  async () => {
    await fetchAuditLogs(
      1
    )
  }

// ============================================================
// Reset
// ============================================================

const resetFilters =
  async () => {
    filters.studentId =
      ''

    filters.courseId =
      ''

    filters.actorUserId =
      ''

    filters.actorRole =
      ''

    filters.action =
      ''

    filters.entityType =
      ''

    filters.startDate =
      ''

    filters.endDate =
      ''

    filters.keyword =
      ''

    await fetchAuditLogs(
      1
    )
  }

// ============================================================
// Pagination
// ============================================================

const previousPage =
  async () => {
    if (
      !pagination.value
        .hasPrevious
    ) {
      return
    }

    await fetchAuditLogs(
      pagination.value.page -
      1
    )
  }

const nextPage =
  async () => {
    if (
      !pagination.value
        .hasNext
    ) {
      return
    }

    await fetchAuditLogs(
      pagination.value.page +
      1
    )
  }

// ============================================================
// Mounted
// ============================================================

onMounted(
  async () => {
    await fetchAuditLogs(
      1
    )
  }
)
</script>

<template>
  <main class="audit-page">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <NuxtLink
            to="/teacher"
            class="back-link"
          >
            ← 老師首頁
          </NuxtLink>

          <span>
            Audit
          </span>

          <h1>
            操作紀錄
          </h1>

          <p>
            查詢老師與學生對出席、請假、補課、課堂與方案的所有異動。
          </p>
        </div>
      </header>

      <!-- ====================================================
           Error
           ==================================================== -->

      <div
        v-if="
          errorMessage
        "
        class="error-message"
      >
        {{
          errorMessage
        }}
      </div>

      <!-- ====================================================
           Summary
           ==================================================== -->

      <section class="summary-grid">
        <article>
          <span>
            符合條件
          </span>

          <strong>
            {{
              summary.total
            }}
          </strong>
        </article>

        <article>
          <span>
            本頁新增
          </span>

          <strong>
            {{
              summary.create
            }}
          </strong>
        </article>

        <article>
          <span>
            本頁修改
          </span>

          <strong>
            {{
              summary.update
            }}
          </strong>
        </article>

        <article>
          <span>
            本頁取消
          </span>

          <strong>
            {{
              summary.cancel
            }}
          </strong>
        </article>

        <article>
          <span>
            本頁恢復
          </span>

          <strong>
            {{
              summary.restore
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Filters
           ==================================================== -->

      <section class="filter-card">
        <input
          v-model="
            filters.keyword
          "
          type="search"
          placeholder="關鍵字、備註、學生、操作者..."
          @keyup.enter="
            search
          "
        >

        <select
          v-model="
            filters.studentId
          "
        >
          <option value="">
            全部學生
          </option>

          <option
            v-for="
              student in
                options.students
            "
            :key="
              student.id
            "
            :value="
              student.id
            "
          >
            {{
              student.name
            }}
          </option>
        </select>

        <select
          v-model="
            filters.courseId
          "
        >
          <option value="">
            全部課程
          </option>

          <option
            v-for="
              course in
                options.courses
            "
            :key="
              course.id
            "
            :value="
              course.id
            "
          >
            {{
              course.name
            }}
          </option>
        </select>

        <select
          v-model="
            filters.actorUserId
          "
        >
          <option value="">
            全部操作者
          </option>

          <option
            v-for="
              actor in
                options.actors
            "
            :key="
              actor.id
            "
            :value="
              actor.id
            "
          >
            {{
              getActorLabel(
                actor
              )
            }}
          </option>
        </select>

        <select
          v-model="
            filters.actorRole
          "
        >
          <option value="">
            全部角色
          </option>

          <option value="TEACHER">
            老師
          </option>

          <option value="STUDENT">
            學生
          </option>

          <option value="SYSTEM">
            系統
          </option>
        </select>

        <select
          v-model="
            filters.action
          "
        >
          <option value="">
            全部 Action
          </option>

          <option
            v-for="
              action in
                options.actions
            "
            :key="
              action
            "
            :value="
              action
            "
          >
            {{
              getActionLabel(
                action
              )
            }}
          </option>
        </select>

        <select
          v-model="
            filters.entityType
          "
        >
          <option value="">
            全部 Entity
          </option>

          <option
            v-for="
              entityType in
                options.entityTypes
            "
            :key="
              entityType
            "
            :value="
              entityType
            "
          >
            {{
              getEntityLabel(
                entityType
              )
            }}
          </option>
        </select>

        <input
          v-model="
            filters.startDate
          "
          type="date"
        >

        <input
          v-model="
            filters.endDate
          "
          type="date"
        >

        <div class="filter-actions">
          <button
            type="button"
            @click="
              resetFilters
            "
          >
            清除
          </button>

          <button
            type="button"
            class="search-button"
            @click="
              search
            "
          >
            搜尋
          </button>
        </div>
      </section>

      <!-- ====================================================
           Records
           ==================================================== -->

      <section class="records-section">
        <div
          v-if="
            loading
          "
          class="empty-state"
        >
          載入中...
        </div>

        <div
          v-else-if="
            records.length
          "
          class="record-list"
        >
          <AuditLogCard
            v-for="
              log in records
            "
            :key="
              log.id
            "
            :log="
              log
            "
          />
        </div>

        <div
          v-else
          class="empty-state"
        >
          沒有符合條件的 Audit Log。
        </div>
      </section>

      <!-- ====================================================
           Pagination
           ==================================================== -->

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
            !pagination.hasPrevious ||
            loading
          "
          @click="
            previousPage
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

          共
          {{
            pagination.total
          }}
          筆
        </span>

        <button
          type="button"
          :disabled="
            !pagination.hasNext ||
            loading
          "
          @click="
            nextPage
          "
        >
          下一頁 →
        </button>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.audit-page {
  min-height: 100vh;
  padding:
    28px
    20px
    60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.back-link {
  display: block;
  margin-bottom: 14px;
  color: #777777;
  font-size: 11px;
  text-decoration: none;
}

.page-header > div > span {
  color: #999999;
  font-size: 10px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 4px 0 0;
}

.page-header p {
  margin: 6px 0 0;
  color: #888888;
  font-size: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      5,
      1fr
    );
  gap: 9px;
  margin-top: 20px;
}

.summary-grid article {
  padding: 14px;
  background: #ffffff;
  border-radius: 16px;
}

.summary-grid span {
  color: #999999;
  font-size: 9px;
}

.summary-grid strong {
  display: block;
  margin-top: 7px;
  font-size: 20px;
}

.filter-card {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      minmax(
        0,
        1fr
      )
    );
  gap: 8px;
  margin-top: 14px;
  padding: 15px;
  background: #ffffff;
  border-radius: 18px;
}

.filter-card input,
.filter-card select {
  min-height: 39px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
  font-size: 10px;
}

.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.filter-actions button,
.pagination button {
  min-height: 35px;
  padding: 0 12px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
  font-size: 9px;
  cursor: pointer;
}

.search-button {
  background: #222222 !important;
  color: #ffffff;
}

.records-section {
  margin-top: 15px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.empty-state {
  padding: 38px;
  background: #ffffff;
  border-radius: 18px;
  color: #aaaaaa;
  text-align: center;
}

.error-message {
  margin-top: 12px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 10px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 18px;
}

.pagination span {
  color: #777777;
  font-size: 9px;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}

@media (
  max-width: 850px
) {
  .summary-grid {
    grid-template-columns:
      1fr
      1fr;
  }

  .filter-card {
    grid-template-columns:
      1fr
      1fr;
  }
}

@media (
  max-width: 520px
) {
  .audit-page {
    padding:
      18px
      13px
      45px;
  }

  .filter-card {
    grid-template-columns:
      1fr;
  }

  .pagination {
    justify-content: space-between;
  }
}
</style>