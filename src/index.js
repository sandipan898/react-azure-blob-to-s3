import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import _ from 'lodash';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import '../config';

//Import Azure storage blob SDK modules

import {Aborter, ServiceURL, ContainerURL, StorageURL, AnonymousCredential} from '@azure/storage-blob';

//Azure account name and container to read blobs from

const account   = CONFIG.ACCOUNT    // Add azure account name
const container = CONFIG.CONTAINER  // Add container of storage to read

class BlobStorageViewer extends React.Component {
  constructor() {
    super();
      this.state = {  
        data: [],
        pages: 2,
        markers: [],
        loading: true,
        prefix: ""
      };
      this.fetchData = this.listBlobs.bind(this);
  }

  listBlobs (state, instance) {
    
    //This lists blobs in pages defined in state.pagesize

    this.setState({ loading: true});

    //Use AnonymousCredential since container is made a 'public container' and does not require authorization

    const anonymousCredential = new AnonymousCredential();
    const pipeline = StorageURL.newPipeline(anonymousCredential)

    const serviceURL = new ServiceURL(
      `https://${account}.blob.core.windows.net`, pipeline
    )

    //If you are using a SAS token, append to container below
    //We are using anonymous access here at the moment. See above.

    const containerName = container // + <SAS_TOKEN>
    const containerURL = ContainerURL.fromServiceURL(serviceURL, containerName)

    //Fetch the prefix in the query params to browse into folders

    const urlParams = new URLSearchParams(window.location.search);
    const prefix = urlParams.get('prefix')

    //List objects from blog storage including folders including metadata. Delimiter for virtual directors(folders) is a forward slash.

    containerURL.listBlobHierarchySegment (
      Aborter.none,
      '/',
      state.markers[state.page],
      {
        include: [
          'metadata'
        ],
        maxresults: state.pagesize,
        prefix: prefix
      }
    ).then(res => {

      //Store the nextMarker in an arra for prev/next buttons only if there are more blobs to show

      const markers = state.markers.slice();
      var totalPages = state.page + 1;
        if (res.nextMarker) {
          markers[(state.page + 1)] = res.nextMarker;
          totalPages++;
        }

      //Combine the found virtual directories and files

      Array.prototype.push.apply(res.segment.blobItems, res.segment.blobPrefixes)

      //This is to sort rows and handles blobName, contentLength and lastModified

      const sortedData = _.orderBy(
        res.segment.blobItems, 
        state.sorted.map(sort => {
          return row => {
            if (row[sort.id] === null) {
              return -Infinity;
            }
            //Following is a workaround to special case contentLength and lastModified
            else if (row[sort.id] === undefined) {
              if (row.properties === undefined) {
                return -Infinity;
              } else {
                return row.properties[sort.id];
              }
            }
            return typeof row[sort.id] === 'string'
              ? row[sort.id].toLowerCase()
              : row[sort.id];
          };
        }),
        state.sorted.map(d => (d.desc ? 'desc' : 'asc'))
      );

      //Store the state

      this.setState({
        data: sortedData,
        pages: totalPages,
        markers: markers,
        loading: false,
        prefix: prefix
      });
    });
  }

  //Custom links for various scenarios (handles blobs, directories and go back link)

  renderLink (blobName) {
    var link;
    if (blobName === '../') { 
      link = '='
    } else if (blobName.slice(-1) === '/') {
      link = '?prefix' + blobName
      blobName = <span><i className="fas fa-folder">&nbsp;</i>{blobName}</span>
    } else {
      link = `https://ecavdata1storage.blob.core.windows.net/${container}/` + blobName
    }
    return (
      <a href={link} className="blob-link">{blobName}</a>
    );
  }

  render () {
    const { data, pages, markers, loading, prefix } = this.state;

    //If this is a directory/folder view, add a go back link for the root

    var dataset = data
    if (prefix != null) {
      dataset = [{name: '../'}].concat(dataset);
    }

    //Here we return the react-table with the blob data mapped to it

    return(
      <div>
        <ReactTable
          columns={[
            {
              Header: 'Blob name',
              id: 'name',
              accessor: 'name',
              maxWidth: '35%',
              Cell: row => (
                this.renderLink(row.value)
              )
            },
            {
              Header: 'Publisher',
              id: 'publisher',
              accessor: (d) => {
                if (typeof d.properties !== 'undefined') {
                  return d.metadata.Publisher
                }
              },
              maxWidth: '35%'
            },

            {
              Header: 'Category',
              id: 'category',
              accessor: (d) => {
                if (typeof d.properties !== 'undefined') {
                  return d.metadata.Category
                }
              },
              maxWidth: '35%'
            },

            {
              Header: 'License',
              id: 'license',
              accessor: (d) => {
                if (typeof d.properties !== 'undefined') {
                  return d.metadata.License
                }
              },
              maxWidth: '35%'
            },
            {
              Header: 'Content size',
              id: 'contentLength',
              accessor: (d) => {
                if (typeof d.properties !== 'undefined') {
                  return Math.floor(d.properties.contentLength / 1000) + 'KB'
                }
              },
              maxWidth: '10%'
            },
            {
              Header: 'Content Type',
              id: 'contentType',
              accessor: (d) => {
                if (typeof d.properties !== 'undefined') {
                  return d.properties.contentType
                }
              },
              maxWidth: '10%'
            },
            {
              Header: 'Last Modified',
              id: 'lastModified',
              accessor: (d) => {
                if (typeof d.properties !== 'undefined') {
                  return d.properties.lastModified.toISOString()
                }
              },
              maxWidth: '10%'
            },
            {
              Header: 'Download',
              id: 'download',
              accessor: (d) => {
                if (typeof d.properties!== 'undefined') {
                  return <a href={`https://${account}.blob.core.windows.net/` + container + '/' + d.name}><i className="fas fa-cloud-download-alt blob-download-icon"></i></a>
                }
              },
              maxWidth: '10%'
            },
          ]}

          manual // Instruction to react-table to not paginate as we can only list objects in pages from blob storage
          data={dataset}
          pages={pages}
          markers={markers}
          loading={loading}
          onFetchData={this.fetchData}
          defaultPageSize={10}
          className='-highlight'
        />
      </div>
    );
  }
}

ReactDOM.render(<BlobStorageViewer />, document.getElementById('root'));
