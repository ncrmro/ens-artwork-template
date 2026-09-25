// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {PermissionedRegistry} from "../vendor/ens-v2/src/registry/PermissionedRegistry.sol";
import {IRegistry} from "../vendor/ens-v2/src/registry/interfaces/IRegistry.sol";
import {IRegistryURIRenderer} from "../vendor/ens-v2/src/registry/interfaces/IRegistryURIRenderer.sol";
import {ILabelStore} from "../vendor/ens-v2/src/utils/interfaces/ILabelStore.sol";
import {ArtResolver} from "./ArtResolver.sol";
import {MandateRegistry} from "./MandateRegistry.sol";

/// A gallery-controlled collection of immutable, attributed exhibition statements.
contract GalleryRegistry is PermissionedRegistry, IRegistryURIRenderer {
    struct Exhibition { string label; string title; string manifestURI; address artwork; uint256 artworkId; address mandates; uint256 mandateId; address issuer; uint64 recordedAt; string custodyStatement; }
    struct Publication { string label; string title; string manifestURI; bytes contenthash; string custodyStatement; }
    address public immutable gallery;
    bytes32 public immutable namespaceNode;
    ArtResolver public immutable exhibitionResolver;
    mapping(uint256=>Exhibition) private exhibitions;
    uint256[] private ids;
    event ExhibitionPublished(uint256 indexed id,address indexed artwork,uint256 indexed artworkId,uint256 mandateId);
    constructor(ILabelStore store,IRegistry parent,bytes32 node,address gallery_) PermissionedRegistry(store,gallery_,0) {
        require(gallery_!=address(0),"Gallery required");
        gallery=gallery_; namespaceNode=node; _parentRegistry=parent; _childLabel="exhibitions";
        exhibitionResolver=new ArtResolver(); _uriRenderer=IRegistryURIRenderer(address(this));
    }
    function publish(Publication calldata p,MandateRegistry mandates,uint256 mandateId) external {
        require(msg.sender==gallery,"Only gallery");
        require(mandates.active(mandateId,16),"Exhibition mandate inactive");
        MandateRegistry.Mandate memory m=mandates.get(mandateId);
        require(m.gallery==gallery,"Wrong gallery");
        _validateLabel(p.label);
        bytes memory u=bytes(p.manifestURI);
        require(bytes(p.title).length>0 && bytes(p.title).length<=128 && u.length>7 && u.length<=256 && bytes7(u)==bytes7("ipfs://"),"Title and IPFS manifest required");
        require(bytes(p.custodyStatement).length<=512,"Statement too long");
        uint256 id=uint256(keccak256(bytes(p.label))); uint256 k=id & ~uint256(type(uint32).max);
        require(exhibitions[k].issuer==address(0),"Exhibition exists");
        exhibitions[k]=Exhibition(p.label,p.title,p.manifestURI,address(mandates.artwork()),m.tokenId,address(mandates),mandateId,msg.sender,uint64(block.timestamp),p.custodyStatement);
        exhibitionResolver.publish(keccak256(abi.encodePacked(namespaceNode,bytes32(id))),p.contenthash,p.manifestURI);
        _register(p.label,gallery,IRegistry(address(0)),address(exhibitionResolver),0,type(uint64).max,false);
        ids.push(id); emit ExhibitionPublished(id,address(mandates.artwork()),m.tokenId,mandateId);
    }
    function _validateLabel(string calldata label) private pure {
        bytes memory l=bytes(label); require(l.length>0 && l.length<=63,"Invalid label");
        for(uint256 i;i<l.length;++i) require((l[i]>=0x61&&l[i]<=0x7a)||(l[i]>=0x30&&l[i]<=0x39)||(l[i]==0x2d&&i>0&&i+1<l.length),"Lowercase label required");
    }
    function register(string memory,address,IRegistry,address,uint256,uint64) public pure override returns(uint256) { revert("Use publish"); }
    function recordCount() external view returns(uint256) { return ids.length; }
    function recordId(uint256 i) external view returns(uint256) { return ids[i]; }
    function exhibition(uint256 id) external view returns(Exhibition memory) { return exhibitions[id & ~uint256(type(uint32).max)]; }
    function renderURI(IRegistry registry,uint256 id) external view returns(string memory) { require(address(registry)==address(this),"Wrong registry"); return exhibitions[id & ~uint256(type(uint32).max)].manifestURI; }
    function supportsInterface(bytes4 id) public view override returns(bool) { return id==type(IRegistryURIRenderer).interfaceId || super.supportsInterface(id); }
}
