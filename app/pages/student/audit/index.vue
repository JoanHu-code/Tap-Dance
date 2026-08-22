<script setup>
definePageMeta({
  middleware:
    'student-auth',
})

// ============================================================
// State
// ============================================================

const loading =
  ref(true)

const errorMessage =
  ref('')

const student =
  ref(null)

const records =
  ref([])

const summary =
  ref({
    total: 0,
    create: 0,
    update: 0,
    cancel: 0,
    restore: 0,
    renew: 0,
    link: 0,
    unlink: 0,
  })

const pagination =
  ref({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  })

const options =
  ref({
    actions: [],
    entityTypes: [],
    courses: [],
  })

// ============================================================
// Filters
// ============================================================

const filters =
  ref({
    keyword: '',
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  })

// ============================================================
// Fetch
// ============================================================

const fetchAuditLogs =
  async (
    page = 1
  ) => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/student/audit',
          {
            query: {
              keyword:
                filters.value
                  .keyword
                  ?.trim() ||
                undefined,

              action:
                filters.value
                  .action ||
                undefined,

              entityType:
                filters.value
                  .entityType ||
                undefined,

              startDate:
                filters.value
                  .startDate ||
                undefined,

              endDate:
                filters.value
                  .endDate ||
                undefined,

              page,

              pageSize:
                pagination.value
                  .pageSize,
            },
          }
        )

      student.value =
        response.student ||
        null

      records.value =
        response.records ||
        []

      summary.value =
        response.summary ||
        {
          total: 0,
          create: 0,
          update: 0,
          cancel: 0,
          restore: 0,
          renew: 0,
          link: 0,
          unlink: 0,
        }

      pagination.value =
        response.pagination ||
        pagination.value

      options.value =
        response.options ||
        {
          actions: [],
          entityTypes: [],
          courses: [],
        }
    } catch (error) {
      console.error(
        '學生 Audit Log 載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '操作紀錄載入失敗'
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

const reset =
  async () => {
    filters.value = {
      keyword: '',
      action: '',
      entityType: '',
      startDate: '',
      endDate: '',
    }

    await fetchAuditLogs(
      1
    )
  }

// ============================================================
// Previous
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

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

// ============================================================
// Next
// ============================================================

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

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

// ============================================================
// Lifecycle
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
  <main class="student-audit-page">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <NuxtLink
            to="/student"
            class="back-link"
          >
            ← 我的課程
          </NuxtLink>

          <span>
            My Timeline
          </span>

          <h1>
            我的操作紀錄
          </h1>

          <p>
            {{
              student?.name ||
              ''
            }}
          </p>
        </div>
      </header>

      <!-- ====================================================
           Introduction
           ==================================================== -->

      <section class="intro-card">
        <strong>
          完整異動紀錄
        </strong>

        <p>
          這裡會保留與你相關的簽到、請假、補課、方案續期與其他資料異動。無論是你自己、老師或系統進行的操作，只要與你的資料有關，都可以在這裡查詢。
        </p>
      </section>

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
            總紀錄
          </span>

          <strong>
            {{
              summary.total
            }}
          </strong>
        </article>

        <article>
          <span>
            新增
          </span>

          <strong>
            {{
              summary.create
            }}
          </strong>
        </article>

        <article>
          <span>
            修改
          </span>

          <strong>
            {{
              summary.update
            }}
          </strong>
        </article>

        <article>
          <span>
            取消
          </span>

          <strong>
            {{
              summary.cancel
            }}
          </strong>
        </article>

        <article>
          <span>
            恢復
          </span>

          <strong>
            {{
              summary.restore
            }}
          </strong>
        </article>

        <article>
          <span>
            續期
          </span>

          <strong>
            {{
              summary.renew
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Filter
           ==================================================== -->

      <section class="filter-section">
        <div class="section-title">
          <span>
            Search
          </span>

          <h2>
            搜尋紀錄
          </h2>
        </div>

        <StudentAuditFilter
          v-model="
            filters
          "
          :actions="
            options.actions
          "
          :entity-types="
            options.entityTypes
          "
          :loading="
            loading
          "
          @search="
            search
          "
          @reset="
            reset
          "
        />
      </section>

      <!-- ====================================================
           Timeline
           ==================================================== -->

      <section class="timeline-section">
        <div class="section-title timeline-title">
          <div>
            <span>
              Timeline
            </span>

            <h2>
              完整時間軸
            </h2>
          </div>

          <span class="record-count">
            {{
              pagination.total
            }}
            筆
          </span>
        </div>

        <StudentAuditTimeline
          :records="
            records
          "
          :pagination="
            pagination
          "
          :loading="
            loading
          "
          @previous="
            previousPage
          "
          @next="
            nextPage
          "
        />
      </section>
    </div>
  </main>
</template>

<style scoped>
.student-audit-page {
  min-height: 100vh;
  padding:
    20px
    14px
    50px;
  background: #f7f7f7;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.back-link {
  display: block;
  margin-bottom: 13px;
  color: #777777;
  font-size: 10px;
  text-decoration: none;
}

.page-header > div > span,
.section-title > span,
.section-title > div > span {
  color: #999999;
  font-size: 9px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin:
    4px
    0
    0;
  font-size: 24px;
}

.page-header p {
  margin:
    4px
    0
    0;
  color: #888888;
  font-size: 10px;
}

/* ============================================================
   Intro
   ============================================================ */

.intro-card {
  margin-top: 17px;
  padding: 15px;
  background: #222222;
  border-radius: 17px;
  color: #ffffff;
}

.intro-card strong {
  font-size: 11px;
}

.intro-card p {
  margin:
    7px
    0
    0;
  color:
    rgb(
      255
      255
      255
      /
      68%
    );
  font-size: 9px;
  line-height: 1.7;
}

/* ============================================================
   Summary
   ============================================================ */

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 7px;
  margin-top: 13px;
}

.summary-grid article {
  padding: 11px;
  background: #ffffff;
  border-radius: 13px;
}

.summary-grid span {
  color: #999999;
  font-size: 8px;
}

.summary-grid strong {
  display: block;
  margin-top: 5px;
  font-size: 17px;
}

/* ============================================================
   Sections
   ============================================================ */

.filter-section,
.timeline-section {
  margin-top: 19px;
}

.section-title h2 {
  margin:
    3px
    0
    9px;
  font-size: 16px;
}

.timeline-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}

.timeline-title > div h2 {
  margin:
    3px
    0
    9px;
}

.record-count {
  margin-bottom: 9px;
  color: #999999;
  font-size: 9px;
}

/* ============================================================
   Error
   ============================================================ */

.error-message {
  margin-top: 11px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 9px;
  line-height: 1.5;
}

@media (
  max-width: 420px
) {
  .summary-grid {
    grid-template-columns:
      1fr
      1fr;
  }
}
</style>