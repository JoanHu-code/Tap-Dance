<script setup>
const props =
  defineProps({
    studentId: {
      type: String,
      required: true,
    },

    pageSize: {
      type: Number,
      default: 10,
    },
  })

const loading =
  ref(false)

const errorMessage =
  ref('')

const records =
  ref([])

const pagination =
  ref({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  })

// ============================================================
// Fetch
//
// 直接使用既有 Teacher Audit API。
// 不再另外做一支重複 API。
// ============================================================

const fetchTimeline =
  async (
    page = 1
  ) => {
    if (
      !props.studentId
    ) {
      return
    }

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
                props.studentId,

              page,

              pageSize:
                props.pageSize,
            },
          }
        )

      records.value =
        response.records ||
        []

      pagination.value =
        response.pagination ||
        pagination.value
    } catch (error) {
      console.error(
        'Student Audit Timeline 載入失敗：',
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

    await fetchTimeline(
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

    await fetchTimeline(
      pagination.value.page +
      1
    )
  }

// ============================================================
// Watch Student
// ============================================================

watch(
  () =>
    props.studentId,
  async (
    value
  ) => {
    if (
      value
    ) {
      await fetchTimeline(
        1
      )
    }
  },
  {
    immediate: true,
  }
)
</script>

<template>
  <section class="timeline-section">
    <!-- ======================================================
         Header
         ====================================================== -->

    <header class="timeline-header">
      <div>
        <span>
          Audit Timeline
        </span>

        <h2>
          操作紀錄
        </h2>
      </div>

      <NuxtLink
        :to="{
          path:
            '/teacher/audit',

          query: {
            studentId,
          },
        }"
        class="all-link"
      >
        查看全部
      </NuxtLink>
    </header>

    <!-- ======================================================
         Error
         ====================================================== -->

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
      <div
        v-for="
          log in records
        "
        :key="
          log.id
        "
        class="timeline-item"
      >
        <span class="timeline-dot" />

        <AuditLogCard
          :log="
            log
          "
          :compact="
            true
          "
        />
      </div>
    </div>

    <div
      v-else
      class="empty-state"
    >
      這位學生目前還沒有 Audit Log。
    </div>

    <!-- ======================================================
         Pagination
         ====================================================== -->

    <footer
      v-if="
        pagination.total >
        pageSize
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
        上一頁
      </button>

      <span>
        {{
          pagination.page
        }}
        /
        {{
          pagination.totalPages
        }}
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
        下一頁
      </button>
    </footer>
  </section>
</template>

<style scoped>
.timeline-section {
  margin-top: 20px;
}

.timeline-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.timeline-header span {
  color: #999999;
  font-size: 9px;
  letter-spacing: 1px;
}

.timeline-header h2 {
  margin: 3px 0 0;
  font-size: 17px;
}

.all-link {
  color: #666666;
  font-size: 9px;
  text-decoration: none;
}

.timeline-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 11px;
  padding-left: 18px;
}

.timeline-list::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 5px;
  width: 1px;
  background: #dddddd;
  content: '';
}

.timeline-item {
  position: relative;
}

.timeline-dot {
  position: absolute;
  top: 17px;
  left: -17px;
  z-index: 1;
  width: 9px;
  height: 9px;
  background: #ffffff;
  border: 2px solid #888888;
  border-radius: 50%;
}

.empty-state {
  margin-top: 11px;
  padding: 28px;
  background: #ffffff;
  border-radius: 16px;
  color: #aaaaaa;
  font-size: 10px;
  text-align: center;
}

.error-message {
  margin-top: 10px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 9px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}

.pagination button {
  min-height: 31px;
  padding: 0 10px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  font-size: 8px;
}

.pagination button:disabled {
  opacity: 0.4;
}

.pagination span {
  color: #888888;
  font-size: 8px;
}
</style>