import {
  requireAuth,
} from '../../../utils/authSession.js'

import {
  getAuditFilterOptions,
  queryAuditLogs,
} from '../../../services/auditQueryService.js'

export default defineEventHandler(
  async (
    event
  ) => {
    // ========================================================
    // Teacher Auth
    // ========================================================

    const user =
      await requireAuth(
        event
      )

    if (
      user.role !==
      'TEACHER'
    ) {
      throw createError({
        statusCode: 403,

        statusMessage:
          '只有老師可以查看完整 Audit Log',
      })
    }

    // ========================================================
    // Query
    // ========================================================

    const query =
      getQuery(
        event
      )

    const result =
      await queryAuditLogs({
        studentId:
          query.studentId,

        courseId:
          query.courseId,

        actorUserId:
          query.actorUserId,

        actorRole:
          query.actorRole,

        action:
          query.action,

        entityType:
          query.entityType,

        entityId:
          query.entityId,

        startDate:
          query.startDate,

        endDate:
          query.endDate,

        keyword:
          query.keyword,

        page:
          query.page,

        pageSize:
          query.pageSize,
      })

    const options =
      await getAuditFilterOptions()

    // ========================================================
    // Summary
    // ========================================================

    const pageRecords =
      result.records

    const summary = {
      total:
        result.pagination.total,

      create:
        pageRecords.filter(
          (
            item
          ) => {
            return (
              item.action ===
              'CREATE'
            )
          }
        ).length,

      update:
        pageRecords.filter(
          (
            item
          ) => {
            return (
              item.action ===
              'UPDATE'
            )
          }
        ).length,

      cancel:
        pageRecords.filter(
          (
            item
          ) => {
            return (
              item.action ===
              'CANCEL'
            )
          }
        ).length,

      restore:
        pageRecords.filter(
          (
            item
          ) => {
            return (
              item.action ===
              'RESTORE'
            )
          }
        ).length,
    }

    return {
      success: true,

      summary,

      records:
        result.records,

      pagination:
        result.pagination,

      options,
    }
  }
)