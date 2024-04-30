import { TriangleRightIcon, DownloadIcon, UploadIcon, TrashIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Type } from "esi-server-store/types";
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import TreeView from "react-composable-treeview";
import { PiFolderPlusThin, PiFolderThin } from "react-icons/pi";
import { BsArrowsCollapse } from "react-icons/bs";
import QuickbarContext from "@contexts/quickbarContext";
import { stringSort } from "utils/main";
import { Link, useParams } from "@remix-run/react";
import * as Dialog from "@radix-ui/react-dialog";
import "@scss/quickbar.scss";
import { typeIconSrc } from "@components/eveIcon";


export interface QuickbarProps {
  typeRecord: Record<string, Type>
  treeValue: Set<string>
  onTreeValueChange: (v: Set<string>) => void
}

interface QuickbarFolderPorps {
  folder: string
  children: React.ReactNode
}

interface QuickbarItemProps {
  typeId: number
}


interface QuickbarContextType {
  typeRecord: Record<string, Type>
  region: string
  treeValue: Set<string>
  onTreeValueChange: (v: Set<string>) => void
}

const QuickbarComponentContext = createContext<QuickbarContextType>({
  typeRecord: {},
  region: '10000002',
  treeValue: new Set(),
  onTreeValueChange: () => {}
})


export function Quickbar({ typeRecord, treeValue, onTreeValueChange }: QuickbarProps) {
  const params = useParams()
  const region = params.region as string
  const { quickbar, moveToFolder } = useContext(QuickbarContext)
  const isQuickbarEmpty = Object.keys(quickbar).length == 1 && quickbar.__root__.length == 0

  const drop = useCallback((event: React.DragEvent) => {
    const typeId = parseInt(event.dataTransfer.getData('text'))
    moveToFolder(typeId, '__root__')
    event.stopPropagation()
    event.preventDefault()
  }, [moveToFolder])

  const allowDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  return (
    <QuickbarComponentContext.Provider value={{ typeRecord, region, treeValue, onTreeValueChange }}>
      <div className="quickbar">
        <div className="quickbar__header">
          <div className="quickbar__actions">
            <CreateFolderButton />
            <button className="quickbar__button" title="Import quickbar">
              <DownloadIcon className="quickbar__button-icon" />
            </button>
            <button className="quickbar__button" title="Export quickbar">
              <UploadIcon className="quickbar__button-icon" />
            </button>
            <ClearQuickbarButton />
          </div>
          <div className="quickbar__options">
            <button className="quickbar__button" title="Colse all folders">
              <BsArrowsCollapse className="quickbar__button-icon" />
            </button>
            <button className="quickbar__button" title="---">
              <MixerHorizontalIcon className="quickbar__button-icon" />
            </button>
          </div>
        </div>

        {isQuickbarEmpty ? (
          <p className="quickbar__empty">Your quickbar is empty</p>
        ) : (
          <TreeView.Root
            value={treeValue}
            onValueChange={onTreeValueChange}
            onDragEnter={allowDrop}
            onDragOver={allowDrop}
            onDrop={drop}
            className="quickbar__tree"
          >

            {quickbar.__root__.sort(stringSort(t => typeRecord[t].name)).map(typeId => (
              <QuickbarItem typeId={typeId} key={typeId} />
            ))}

            {Object.keys(quickbar).sort(stringSort()).map(folder => {
              if(folder == '__root__') return

              return (
                <QuickbarFolder folder={folder} key={folder}>
                  {quickbar[folder].sort(stringSort(t => typeRecord[t].name)).map(typeId => (
                    <QuickbarItem typeId={typeId} key={typeId} />
                  ))}
                </QuickbarFolder>
              )
            })}

          </TreeView.Root>
        )}
      </div>
    </QuickbarComponentContext.Provider>
  )
}

function QuickbarFolder({ folder, children }: QuickbarFolderPorps) {
  const { moveToFolder } = useContext(QuickbarContext)
  const { treeValue, onTreeValueChange } = useContext(QuickbarComponentContext)

  const drop = useCallback((event: React.DragEvent) => {
    const typeId = parseInt(event.dataTransfer.getData('text'))
    moveToFolder(typeId, folder)
    onTreeValueChange(new Set([ `folder:${folder}`, ...treeValue ]))
    event.stopPropagation()
    event.preventDefault()
  }, [folder, moveToFolder, treeValue, onTreeValueChange])

  const allowDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  return (
    <TreeView.Group
      value={`folder:${folder}`}
      className="quickbar-folder"
      onDrop={drop}
      onDragEnter={allowDrop}
      onDragOver={allowDrop}
    >
      <TreeView.Trigger className="quickbar-folder__trigger">
        <TriangleRightIcon className="quickbar-folder__triangle"/>
        <span className="quickbar-folder__label">{folder}</span>
      </TreeView.Trigger>
      <TreeView.Content className="quickbar-folder__content">
        {children}
      </TreeView.Content>
    </TreeView.Group>
  )
}

function QuickbarItem({ typeId }: QuickbarItemProps) {
  const { typeRecord, region } = useContext(QuickbarComponentContext)
  const type = typeRecord[typeId]
  const itemRef = useRef<HTMLLIElement>(null)

  const dragImage = useMemo(() => {
    const image = new Image(64, 64)
    image.src = typeIconSrc(typeId)
    return image
  }, [typeId])

  const dragStart = useCallback((event: React.DragEvent) => {
    itemRef.current?.classList.add('quickbar-item--drag')
    event.dataTransfer.clearData()
    event.dataTransfer.setData('text/plain', typeId.toString())
    event.dataTransfer.dropEffect = 'move'
    event.dataTransfer.setDragImage(dragImage, 16, 16)
  }, [typeId, dragImage, itemRef])

  const dragEnd = useCallback(() => {
    itemRef.current?.classList.remove('quickbar-item--drag')
  }, [itemRef])

  return (
    <TreeView.Item
      value={`item:${type.id}`}
      className="quickbar-item"
      draggable="true"
      onDragStart={dragStart}
      onDragEnd={dragEnd}
      ref={itemRef}
    >
      <Link to={`/region/${region}/type/${type.id}`} className="quickbar-item__link">
        {type.name}
      </Link>
    </TreeView.Item>
  )
}

function CreateFolderButton() {
  const { createFolder } = useContext(QuickbarContext)
  const name = useRef('')
  const [isOpen, setIsOpen] = useState(false)

  function submit() {
    createFolder(name.current)
  }
  function handleKeydown(event: React.KeyboardEvent) {
    if(event.key != 'Enter') return
    submit()
    setIsOpen(false)
    name.current = ''
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger className="quickbar__button" title="Create Folder">
        <PiFolderPlusThin className="quickbar__button-icon" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog__overlay" />
        <Dialog.Content className="dialog">
          <div className="dialog__header">
            <Dialog.Title className="dialog__title">New folder name</Dialog.Title>
            <Dialog.Description className="dialog__description">
              Enter the name of the quickbar folder you want to create
            </Dialog.Description>
          </div>

          <div className="dialog__body">
            <input
              className="dialog__text-input"
              type="text"
              placeholder="folder name"
              defaultValue={name.current}
              onChange={e => name.current = e.target.value}
              onKeyDown={handleKeydown}
              autoFocus
            />
          </div>

          <div className="dialog__footer">
            <Dialog.Close className="button button--corner-left button--text-center">
              Cancel
            </Dialog.Close>
            <Dialog.Close onClick={submit} className="button button--primary button--corner-right button--text-center">
              Create folder
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ClearQuickbarButton() {
  const { clearQuickbar } = useContext(QuickbarContext)

  function submit() {
    clearQuickbar()
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger className="quickbar__button" title="Remove all items from quickbar">
        <TrashIcon className="quickbar__button-icon" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog__overlay" />
        <Dialog.Content className="dialog">
          <div className="dialog__header">
            <Dialog.Title className="dialog__title">Clear quickbar</Dialog.Title>
            <Dialog.Description className="dialog__description">
              Remove all items from quickbar
            </Dialog.Description>
          </div>

          <div className="dialog__footer">
            <Dialog.Close autoFocus className="button button--corner-left button--text-center">
              Cancel
            </Dialog.Close>
            <Dialog.Close onClick={submit} className="button button--primary button--corner-right button--text-center">
              Clear Quickbar
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
