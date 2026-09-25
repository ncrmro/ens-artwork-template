// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {PermissionedRegistry} from "../vendor/ens-v2/src/registry/PermissionedRegistry.sol";
import {IRegistry} from "../vendor/ens-v2/src/registry/interfaces/IRegistry.sol";
import {IRegistryURIRenderer} from "../vendor/ens-v2/src/registry/interfaces/IRegistryURIRenderer.sol";
import {ILabelStore} from "../vendor/ens-v2/src/utils/interfaces/ILabelStore.sol";
import {ArtResolver} from "./ArtResolver.sol";
import {SimpleSettlement} from "./SimpleSettlement.sol";
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
    struct Submission { uint256 exhibitionId; address mandates; uint256 mandateId; address settlement; address submitter; uint8 status; }
    uint256 public submissionCount;
    mapping(uint256=>Submission) public submissions;
    mapping(uint256=>uint256[]) private accepted;
    mapping(bytes32=>bool) private submitted;
    event ExhibitionCreated(uint256 indexed id);
    event ArtworkSubmitted(uint256 indexed submissionId,uint256 indexed exhibitionId,address indexed artist);
    event SubmissionDecided(uint256 indexed submissionId,bool accepted);
    function createExhibition(Publication calldata p) external returns(uint256 id) {
        require(msg.sender==gallery,"Only gallery"); _validateLabel(p.label);
        bytes memory u=bytes(p.manifestURI);
        require(bytes(p.title).length>0 && bytes(p.title).length<=128 && u.length>7 && u.length<=256 && bytes7(u)==bytes7("ipfs://"),"Title and IPFS manifest required");
        require(bytes(p.custodyStatement).length<=512,"Statement too long");
        id=uint256(keccak256(bytes(p.label))); uint256 k=id & ~uint256(type(uint32).max);
        require(exhibitions[k].issuer==address(0),"Exhibition exists");
        exhibitions[k]=Exhibition(p.label,p.title,p.manifestURI,address(0),0,address(0),0,msg.sender,uint64(block.timestamp),p.custodyStatement);
        exhibitionResolver.publish(keccak256(abi.encodePacked(namespaceNode,bytes32(id))),p.contenthash,p.manifestURI);
        _register(p.label,gallery,IRegistry(address(0)),address(exhibitionResolver),0,type(uint64).max,false);
        ids.push(id); emit ExhibitionCreated(id);
    }
    function submit(uint256 exhibitionId,MandateRegistry mandates,uint256 mandateId,SimpleSettlement settlement) external returns(uint256 id) {
        uint256 k=exhibitionId & ~uint256(type(uint32).max);
        require(exhibitions[k].issuer!=address(0),"Unknown exhibition");
        MandateRegistry.Mandate memory m=mandates.get(mandateId);
        require(m.owner==msg.sender && mandates.artwork().ownerOf(m.tokenId)==msg.sender && mandates.artwork().ownershipEpoch(m.tokenId)==m.epoch,"Only current owner");
        require(m.gallery==gallery && !m.revoked && m.expires>block.timestamp && m.roles & 16 != 0,"Invalid exhibition mandate");
        require(address(settlement.mandates())==address(mandates),"Wrong settlement");
        bytes32 key=keccak256(abi.encode(k,mandates,mandateId)); require(!submitted[key],"Already submitted"); submitted[key]=true;
        id=++submissionCount; submissions[id]=Submission(exhibitionId,address(mandates),mandateId,address(settlement),msg.sender,1);
        emit ArtworkSubmitted(id,exhibitionId,msg.sender);
    }
    function decide(uint256 id,bool accept_) external {
        require(msg.sender==gallery,"Only gallery"); Submission storage s=submissions[id]; require(s.status==1,"Not pending");
        if(accept_) { require(MandateRegistry(s.mandates).active(s.mandateId,16),"Accept active mandate first"); accepted[s.exhibitionId & ~uint256(type(uint32).max)].push(id); }
        s.status=accept_ ? 2 : 3; emit SubmissionDecided(id,accept_);
    }
    function acceptedSubmissions(uint256 exhibitionId) external view returns(uint256[] memory) { return accepted[exhibitionId & ~uint256(type(uint32).max)]; }
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
