import { TriangleRightIcon, DownloadIcon, UploadIcon, TrashIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Type } from "esi-server-store/types";
import { createContext, useContext } from "react";
import TreeView from "react-composable-treeview";
import { PiFolderPlusThin, PiFolderThin } from "react-icons/pi";
import { BsArrowsCollapse } from "react-icons/bs";
import "@scss/quickbar.scss";
import QuickbarContext from "@contexts/quickbarContext";
import { stringSort } from "utils/main";
import { Link, useParams } from "@remix-run/react";


export interface QuickbarProps {
  typeRecord: Record<string, Type>
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
}

const QuickbarComponentContext = createContext<QuickbarContextType>({
  typeRecord: {},
  region: '10000002'
})


export function Quickbar({ typeRecord }: QuickbarProps) {
  const params = useParams()
  const region = params.region as string
  const { quickbar, moveToFolder } = useContext(QuickbarContext)
  const isQuickbarEmpty = Object.keys(quickbar).length == 1 && quickbar.__root__.length == 0
  
  // moveToFolder(81024, 'folder 1')

  return (
    <QuickbarComponentContext.Provider value={{ typeRecord, region }}>
      <div className="quickbar">
        <div className="quickbar__header">
          <div className="quickbar__actions">
            <button className="quickbar__button" title="Create Folder">
              <PiFolderPlusThin className="quickbar__button-icon" />
            </button>
            <button className="quickbar__button" title="Import quickbar">
              <DownloadIcon className="quickbar__button-icon" />
            </button>
            <button className="quickbar__button" title="Export quickbar">
              <UploadIcon className="quickbar__button-icon" />
            </button>
            <button className="quickbar__button" title="Remove all items from quickbar">
              <TrashIcon className="quickbar__button-icon" />
            </button>
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
          <TreeView.Root className="quickbar__tree">

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

  return (
    <TreeView.Group value={`folder:${folder}`} className="quickbar-folder">
      <TreeView.Trigger className="quickbar-folder__trigger">
        <TriangleRightIcon className="quickbar-folder__triangle"/>
        <span className="quickbar-folder__label">{folder}</span>
      </TreeView.Trigger>
      <TreeView.Content>
        {children}
      </TreeView.Content>
    </TreeView.Group>
  )
}

function QuickbarItem({ typeId }: QuickbarItemProps) {
  const { typeRecord, region } = useContext(QuickbarComponentContext)
  const type = typeRecord[typeId]

  return (
    <TreeView.Item value={`item:${type.id}`} className="quickbar-item">
      <Link to={`/region/${region}/type/${type.id}`} className="quickbar-item__link">
        {type.name}
      </Link>
    </TreeView.Item>
  )
}
