import React, { useEffect, useState } from 'react'
import { Tooltip, Popconfirm, Icon, Divider, Badge, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { CardTable } from '@pingcap-incubator/dashboard_components'
import client from '@/utils/client'

const STATUS_DOWN = 0
const STATUS_UP = 1
const STATUS_TOMBSTONE = 2
const STATUS_OFFLINE = 3

function useStatusColumnRender(handleHideTiDB) {
  const { t } = useTranslation()
  return (_, node) => {
    if (node.status == null) {
      // Tree node
      return
    }
    let statusNode = null
    switch (node.status) {
      case STATUS_DOWN:
        statusNode = (
          <Badge
            status="error"
            text={t('cluster_info.list.instance_table.status.down')}
          />
        )
        break
      case STATUS_UP:
        statusNode = (
          <Badge
            status="success"
            text={t('cluster_info.list.instance_table.status.up')}
          />
        )
        break
      case STATUS_TOMBSTONE:
        statusNode = (
          <Badge
            status="default"
            text={t('cluster_info.list.instance_table.status.tombstone')}
          />
        )
        break
      case STATUS_OFFLINE:
        statusNode = (
          <Badge
            status="processing"
            text={t('cluster_info.list.instance_table.status.offline')}
          />
        )
        break
      default:
        statusNode = (
          <Badge
            status="error"
            text={t('cluster_info.list.instance_table.status.unknown')}
          />
        )
        break
    }
    return (
      <span>
        {statusNode}
        {node.nodeKind === 'tidb' && node.status !== STATUS_UP && (
          <>
            <Divider type="vertical" />
            <Popconfirm
              title={t(
                'cluster_info.list.instance_table.actions.hide_db.confirm'
              )}
              onConfirm={() => handleHideTiDB(node)}
            >
              <Tooltip
                title={t(
                  'cluster_info.list.instance_table.actions.hide_db.tooltip'
                )}
              >
                <a>
                  <Icon type="delete" />
                </a>
              </Tooltip>
            </Popconfirm>
          </>
        )}
      </span>
    )
  }
}

function useHideTiDBHandler(updateData) {
  return async node => {
    await client.dashboard.topologyTidbAddressDelete(`${node.ip}:${node.port}`)
    updateData()
  }
}

function useClusterNodeDataSource() {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState([])
  const { t } = useTranslation()

  const fetch = async () => {
    setIsLoading(true)
    try {
      const res = await client.dashboard.topologyAllGet()
      const items = ['tidb', 'tikv', 'pd'].map(nodeKind => {
        const nodes = res.data[nodeKind]
        console.log(nodes);
        if (nodes.err) {
          message.warn(t('cluster_info.error.load', {comp: nodeKind}));
          return {
            key: nodeKind,
            nodeKind,
            children: [],
          }
        }
        const children = nodes.nodes.map(node => {
          if (node.deploy_path === undefined && node.binary_path !== null) {
            node.deploy_path = node.binary_path.substring(
              0,
              node.binary_path.lastIndexOf('/')
            )
          }
          return {
            key: `${node.ip}:${node.port}`,
            ...node,
            nodeKind,
          }
        })
        return {
          key: nodeKind,
          nodeKind,
          children,
        }
      })
      setData(items)
    } catch (e) {}
    setIsLoading(false)
  }

  useEffect(() => {
    fetch()
  }, [])

  return [isLoading, data, fetch]
}

export default function ListPage() {
  const { t } = useTranslation()
  const [isLoading, tableData, updateData] = useClusterNodeDataSource()
  const handleHideTiDB = useHideTiDBHandler(updateData)
  const renderStatusColumn = useStatusColumnRender(handleHideTiDB)

  const columns = [
    {
      title: t('cluster_info.list.instance_table.columns.node'),
      key: 'node',
      ellipsis: true,
      width: 240,
      render: (_, node) => {
        if (node.children) {
          return `${node.nodeKind} (${node.children.length})`
        } else {
          return (
            <Tooltip title={`${node.ip}.${node.port}`}>
              {node.ip}.{node.port}
            </Tooltip>
          )
        }
      },
    },
    {
      title: t('cluster_info.list.instance_table.columns.status'),
      dataIndex: 'status',
      width: 150,
      render: renderStatusColumn,
    },
    {
      title: t('cluster_info.list.instance_table.columns.version'),
      dataIndex: 'version',
      key: 'version',
      ellipsis: true,
      width: 200,
    },
    {
      title: t('cluster_info.list.instance_table.columns.deploy_path'),
      dataIndex: 'deploy_path',
      key: 'deploy_path',
      ellipsis: true,
    },
  ]

  return (
    <CardTable
      title={t('cluster_info.list.instance_table.title')}
      loading={isLoading}
      columns={columns}
      dataSource={tableData}
      expandRowByClick
      defaultExpandAllRows
    />
  )
}
